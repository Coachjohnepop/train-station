#!/usr/bin/env node
/**
 * Remove rows left by blob-migration-loop, s3c, lesson-plan, and chat smoke tests.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-migration-test-data.mjs
 *   node scripts/cleanup-migration-test-data.mjs
 */
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod", override: true });
dotenv.config({ path: ".env.vercel.production", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function isUsableDatabaseUrl(url) {
  if (!url) return false;
  if (url.includes("dummy")) return false;
  if (/user:pass@localhost/i.test(url)) return false;
  return true;
}

function resolveDatabaseUrl() {
  for (const url of [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ]) {
    if (isUsableDatabaseUrl(url)) return url;
  }
  throw new Error("No real Postgres URL in env");
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const live = await prisma.liveWorkoutSession.findMany({
    where: {
      OR: [
        { userId: "migration-loop-user" },
        { workoutId: { contains: "migration-loop" } },
        { sessionDate: "2099-01-01" },
      ],
    },
  });

  const webhooks = await prisma.stripeWebhookEvent.findMany({
    where: { eventId: { startsWith: "evt_loop_" } },
  });

  const workouts = await prisma.workout.findMany({
    where: {
      OR: [
        { name: { contains: "lp-test-", mode: "insensitive" } },
        { id: { contains: "migration-loop" } },
      ],
    },
    select: { id: true, name: true, source: true },
  });

  const todaySessions = await prisma.coachTodaySession.findMany({
    where: { title: { contains: "S3c soak" } },
    select: { id: true, title: true, sessionDate: true, workoutId: true },
  });

  const chatMessages = await prisma.coachChatMessage.findMany({
    where: { body: { contains: "QA-CHAT" } },
    select: { id: true, threadId: true, body: true },
  });

  console.log("Migration test data scan:");
  console.log(`  live sessions: ${live.length}`);
  console.log(`  webhook events: ${webhooks.length}`);
  console.log(`  workouts: ${workouts.length}`);
  for (const w of workouts) console.log(`    - ${w.id} ${w.name}`);
  console.log(`  today sessions: ${todaySessions.length}`);
  for (const s of todaySessions) console.log(`    - ${s.id} ${s.title}`);
  console.log(`  chat messages: ${chatMessages.length}`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  if (live.length) {
    const r = await prisma.liveWorkoutSession.deleteMany({
      where: {
        OR: [
          { userId: "migration-loop-user" },
          { workoutId: { contains: "migration-loop" } },
          { sessionDate: "2099-01-01" },
        ],
      },
    });
    console.log(`Deleted ${r.count} live session(s)`);
  }

  if (webhooks.length) {
    const r = await prisma.stripeWebhookEvent.deleteMany({
      where: { eventId: { startsWith: "evt_loop_" } },
    });
    console.log(`Deleted ${r.count} webhook event(s)`);
  }

  const workoutIds = workouts.map((w) => w.id);
  if (workoutIds.length) {
    const linkedToday = await prisma.coachTodaySession.deleteMany({
      where: { workoutId: { in: workoutIds } },
    });
    if (linkedToday.count > 0) {
      console.log(`Deleted ${linkedToday.count} today session(s) linked to test workouts`);
    }
    await prisma.workoutLog.deleteMany({ where: { workoutId: { in: workoutIds } } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: workoutIds } } });
    const r = await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
    console.log(`Deleted ${r.count} workout(s)`);
  }

  const todayIds = todaySessions.map((s) => s.id);
  if (todayIds.length) {
    const r = await prisma.coachTodaySession.deleteMany({ where: { id: { in: todayIds } } });
    console.log(`Deleted ${r.count} today session(s)`);
  }

  if (chatMessages.length) {
    const r = await prisma.coachChatMessage.deleteMany({
      where: { body: { contains: "QA-CHAT" } },
    });
    console.log(`Deleted ${r.count} chat message(s)`);
  }

  await prisma.$disconnect();
  await pool.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});