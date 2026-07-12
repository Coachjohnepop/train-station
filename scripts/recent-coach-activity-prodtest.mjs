#!/usr/bin/env node
/**
 * Last N minutes of prod DB activity relevant to coach users.
 * Usage: MINUTES=10 npx tsx scripts/recent-coach-activity-prodtest.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const MINUTES = Number(process.env.MINUTES || "10");
const COACHES = (process.env.COACH_EMAILS || "jeremy@thetrainstation.co,john@thetrainstation.co")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function since() {
  return new Date(Date.now() - MINUTES * 60 * 1000);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)),
  });

  const cutoff = since();
  console.log(`\nCoach DB activity — last ${MINUTES} min (since ${cutoff.toISOString()})\n`);

  const users = await prisma.user.findMany({
    where: { email: { in: COACHES } },
    select: { id: true, email: true, name: true, updatedAt: true },
  });
  console.log("── Users ──");
  for (const u of users) {
    console.log(`  ${u.email} (${u.id})`);
  }
  if (!users.length) console.log("  (no matching user rows)");

  const userIds = users.map((u) => u.id);
  const emailById = Object.fromEntries(users.map((u) => [u.id, u.email]));

  const events = [];

  const workouts = await prisma.workout.findMany({
    where: { updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { exercises: true } },
    },
  });
  for (const w of workouts) {
    events.push({
      at: w.updatedAt,
      who: "coach/catalog",
      what: `workout ${w.createdAt >= cutoff ? "created" : "updated"}: "${w.name}" (${w._count.exercises} ex)`,
      id: w.id,
    });
  }

  const newWorkouts = await prisma.workout.findMany({
    where: { createdAt: { gte: cutoff }, NOT: { updatedAt: { gte: cutoff } } },
    select: { id: true, name: true, createdAt: true, _count: { select: { exercises: true } } },
  });
  for (const w of newWorkouts) {
    if (!workouts.some((x) => x.id === w.id)) {
      events.push({
        at: w.createdAt,
        who: "coach/catalog",
        what: `workout created: "${w.name}" (${w._count.exercises} ex)`,
        id: w.id,
      });
    }
  }

  if (userIds.length) {
    const sessions = await prisma.analyticsSession.findMany({
      where: { userId: { in: userIds }, lastActivityAt: { gte: cutoff } },
      orderBy: { lastActivityAt: "desc" },
      select: { userId: true, lastActivityAt: true, startedAt: true, landingPath: true },
    });
    for (const s of sessions) {
      events.push({
        at: s.lastActivityAt,
        who: emailById[s.userId] || s.userId,
        what: `session active (started ${s.startedAt.toISOString()}, path ${s.landingPath || "?"})`,
        id: s.userId,
      });
    }

    const chatMsgs = await prisma.coachChatMessage.findMany({
      where: { createdAt: { gte: cutoff }, authorId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      include: { thread: { select: { title: true, memberId: true } } },
    });
    for (const m of chatMsgs) {
      const who = emailById[m.authorId] || m.authorName || "coach";
      const body = m.body || `[${m.kind}]`;
      events.push({
        at: m.createdAt,
        who,
        what: `chat (${m.thread?.title || m.threadId}): ${body.slice(0, 80)}${body.length > 80 ? "…" : ""}`,
        id: m.id,
      });
    }

    const liveSessions = await prisma.liveWorkoutSession.findMany({
      where: { updatedAt: { gte: cutoff }, OR: [{ userId: { in: userIds } }, { updatedBy: { in: userIds } }] },
      orderBy: { updatedAt: "desc" },
    });
    for (const s of liveSessions) {
      events.push({
        at: s.updatedAt,
        who: emailById[s.updatedBy] || emailById[s.userId] || s.updatedBy,
        what: `live session ${s.sessionDate} workout=${s.workoutId}`,
        id: `${s.userId}-${s.workoutId}-${s.sessionDate}`,
      });
    }

    const coachSettings = await prisma.coachSettings.findFirst({
      where: { updatedAt: { gte: cutoff } },
    });
    if (coachSettings) {
      events.push({
        at: coachSettings.updatedAt,
        who: "coach-settings",
        what: `settings updated messaging=${coachSettings.messagingEnabled}`,
        id: coachSettings.id,
      });
    }

    const memberUpdates = await prisma.memberProfile.findMany({
      where: { updatedAt: { gte: cutoff } },
      take: 10,
      select: { userId: true, email: true, updatedAt: true },
    });
    for (const p of memberUpdates) {
      events.push({
        at: p.updatedAt,
        who: "admin/members",
        what: `member profile updated: ${p.email || p.userId}`,
        id: p.userId,
      });
    }
  }

  const exercises = await prisma.exercise.findMany({
    where: { updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, name: true, updatedAt: true },
  });
  for (const e of exercises) {
    events.push({ at: e.updatedAt, who: "catalog", what: `exercise updated: "${e.name}"`, id: e.id });
  }

  events.sort((a, b) => b.at - a.at);

  if (!events.length) {
    console.log("── Activity ──");
    console.log("  No rows touched in the last 10 minutes.\n");
    console.log("  (Workout exercise edits may not bump workout.updatedAt — checking exercise rows…)\n");

    const recentWe = await prisma.$queryRaw`
      SELECT we.id, we."workoutId", e.name, w.name as workout_name
      FROM "WorkoutExercise" we
      JOIN "Exercise" e ON e.id = we."exerciseId"
      JOIN "Workout" w ON w.id = we."workoutId"
      WHERE we.id > ${"cmrf" + String(Math.floor(Date.now() / 1000))}
      LIMIT 0
    `.catch(() => []);

    const programTouches = await prisma.programDay.findMany({
      where: { publishedAt: { gte: cutoff } },
      include: { week: { select: { weekNumber: true, program: { select: { slug: true } } } } },
    });
    for (const d of programTouches) {
      events.push({
        at: d.publishedAt,
        who: "program",
        what: `day published W${d.week.weekNumber}D${d.dayNumber} (${d.week.program.slug})`,
        id: d.id,
      });
    }
  }

  console.log("── Activity ──");
  if (!events.length) {
    console.log("  Nothing found in workouts, chat, live sessions, exercises, or program publishes.\n");
  } else {
    for (const e of events) {
      console.log(`  ${e.at.toISOString()}  [${e.who}]  ${e.what}`);
    }
    console.log("");
  }

  console.log("── W1 Home watch (Jeremy test) ──");
  const w1home = await prisma.programDayOption.findMany({
    where: {
      label: "Home",
      day: { week: { weekNumber: 1, program: { slug: "adult" } }, dayNumber: { in: [1, 2] } },
    },
    include: {
      workout: {
        select: { id: true, name: true, updatedAt: true, _count: { select: { exercises: true } } },
      },
      day: { select: { dayNumber: true } },
    },
  });
  for (const o of w1home.sort((a, b) => a.day.dayNumber - b.day.dayNumber)) {
    const touched = o.workout.updatedAt >= cutoff ? " ← touched in window" : "";
    console.log(
      `  W1D${o.day.dayNumber} Home: ${o.workout.id} "${o.workout.name}" (${o.workout._count.exercises} ex) ${o.workout.updatedAt.toISOString()}${touched}`,
    );
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});