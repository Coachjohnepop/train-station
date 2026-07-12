#!/usr/bin/env node
/**
 * Post-session audit — full timeline of what Jeremy did + friction signals.
 * No live polling; run after (or during) a test block.
 *
 * Usage:
 *   npx tsx scripts/jeremy-post-audit-prodtest.mjs
 *   MINUTES=180 npx tsx scripts/jeremy-post-audit-prodtest.mjs
 *   SINCE=2026-07-10T16:30:00Z npx tsx scripts/jeremy-post-audit-prodtest.mjs
 *   INCLUDE_JOHN=1 MINUTES=120 npx tsx scripts/jeremy-post-audit-prodtest.mjs
 */

import dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const MINUTES = Number(process.env.MINUTES || "120");
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const WEEK_FOCUS = Number(process.env.WEEK_FOCUS || "1");
const SUBJECT_EMAIL = (process.env.SUBJECT_EMAIL || "jeremy@thetrainstation.co").trim().toLowerCase();
const INCLUDE_JOHN = process.env.INCLUDE_JOHN === "1";
const JOHN_EMAIL = "john@thetrainstation.co";

function cutoffDate() {
  if (process.env.SINCE) {
    const d = new Date(process.env.SINCE);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(Date.now() - MINUTES * 60 * 1000);
}

function fmtLocal(iso) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncate(s, n = 72) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function isSmsWorkout(w) {
  return w?.source === "sms" || String(w?.id || "").startsWith("sms-w-");
}

function exerciseSummary(exercises) {
  return exercises
    .map((e, i) => `${i + 1}.${e.exercise?.name || "?"}(${e.sets ?? "?"}x${e.reps ?? "?"})`)
    .join(" · ");
}

function detectFriction(timeline, subjectEmail) {
  const flags = [];
  const subject = timeline.filter((e) => e.who === subjectEmail);

  const deleteClicks = subject.filter(
    (e) =>
      e.kind === "click" &&
      /delete|remove|trash/i.test(`${e.detail} ${e.action || ""}`),
  );
  if (deleteClicks.length >= 4) {
    const byMin = new Map();
    for (const c of deleteClicks) {
      const key = c.at.toISOString().slice(0, 16);
      byMin.set(key, (byMin.get(key) || 0) + 1);
    }
    const burst = [...byMin.entries()].filter(([, n]) => n >= 3);
    flags.push({
      severity: "high",
      msg: `${deleteClicks.length} Delete/Remove clicks — possible delete struggle${burst.length ? ` (${burst.length} burst minute(s))` : ""}`,
    });
  }

  const pageViews = subject.filter((e) => e.kind === "page_view");
  const viewsByPath = new Map();
  for (const v of pageViews) {
    const p = v.detail || "?";
    viewsByPath.set(p, (viewsByPath.get(p) || 0) + 1);
  }
  for (const [path, n] of viewsByPath) {
    if (n >= 5) {
      flags.push({
        severity: "medium",
        msg: `${n}× page_view on ${path} — refresh/retry loop?`,
      });
    }
  }

  const pathSequence = subject
    .filter((e) => e.kind === "page_view" || e.kind === "click")
    .map((e) => ({ at: e.at, path: e.path || e.detail }));
  for (let i = 2; i < pathSequence.length; i++) {
    const a = pathSequence[i - 2];
    const b = pathSequence[i - 1];
    const c = pathSequence[i];
    if (a.path === c.path && a.path !== b.path && a.path?.includes("/admin")) {
      const dt = (c.at - a.at) / 1000;
      if (dt < 120) {
        flags.push({
          severity: "medium",
          msg: `Ping-pong ${a.path} ↔ ${b.path} ↔ ${a.path} in ${Math.round(dt)}s — navigation confusion?`,
        });
        break;
      }
    }
  }

  const workoutTouches = subject.filter((e) => e.kind === "db_workout");
  const byWorkout = new Map();
  for (const w of workoutTouches) {
    byWorkout.set(w.id, (byWorkout.get(w.id) || 0) + 1);
  }
  for (const [id, n] of byWorkout) {
    if (n >= 3) {
      flags.push({
        severity: "medium",
        msg: `Workout ${id} saved ${n}× in window — edit not sticking?`,
      });
    }
  }

  const saveClicks = subject.filter(
    (e) => e.kind === "click" && /save|publish|apply/i.test(e.detail || ""),
  );
  const deleteNearSave = deleteClicks.filter((d) =>
    saveClicks.some((s) => Math.abs(s.at - d.at) < 120_000),
  );
  if (deleteNearSave.length >= 2 && saveClicks.length >= 2) {
    flags.push({
      severity: "medium",
      msg: "Delete + Save clicks interleaved — trial-and-error editing",
    });
  }

  return flags;
}

async function main() {
  const cutoff = cutoffDate();
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)),
  });

  const emails = [SUBJECT_EMAIL];
  if (INCLUDE_JOHN) emails.push(JOHN_EMAIL);

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const userByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
  const subjectId = userByEmail[SUBJECT_EMAIL];

  if (!subjectId) {
    console.error(`User not found: ${SUBJECT_EMAIL}`);
    process.exit(1);
  }

  const timeline = [];

  const analytics = await prisma.analyticsEvent.findMany({
    where: { userId: { in: users.map((u) => u.id) }, occurredAt: { gte: cutoff } },
    orderBy: { occurredAt: "asc" },
    select: {
      userId: true,
      occurredAt: true,
      eventType: true,
      pagePath: true,
      pageTitle: true,
      elementText: true,
      clickAction: true,
      clickHref: true,
      workoutId: true,
      exerciseId: true,
      properties: true,
    },
  });

  const emailById = Object.fromEntries(users.map((u) => [u.id, u.email]));
  for (const e of analytics) {
    const who = emailById[e.userId] || "?";
    if (e.eventType === "page_view") {
      timeline.push({
        at: e.occurredAt,
        who,
        kind: "page_view",
        path: e.pagePath,
        detail: e.pagePath || "/",
      });
    } else if (e.eventType === "page_click") {
      timeline.push({
        at: e.occurredAt,
        who,
        kind: "click",
        path: e.pagePath,
        detail: truncate(e.elementText || e.clickAction || e.clickHref || "click"),
        action: e.clickAction,
      });
    } else {
      timeline.push({
        at: e.occurredAt,
        who,
        kind: e.eventType,
        path: e.pagePath,
        detail: truncate(e.elementText || JSON.stringify(e.properties || {})),
      });
    }
  }

  const workouts = await prisma.workout.findMany({
    where: { updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: "asc" },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  for (const w of workouts) {
    const who = isSmsWorkout(w) ? JOHN_EMAIL : SUBJECT_EMAIL;
    timeline.push({
      at: w.updatedAt,
      who: isSmsWorkout(w) ? `${who} (sms)` : "db/catalog",
      kind: "db_workout",
      id: w.id,
      detail: `${w.createdAt >= cutoff ? "created" : "updated"} "${w.name}" (${w.exercises.length} ex)`,
      path: isSmsWorkout(w) ? "sms" : "catalog",
      exercises: w.exercises,
    });
  }

  const exercisesCreated = await prisma.exercise.findMany({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: "asc" },
  });
  for (const e of exercisesCreated) {
    timeline.push({
      at: e.createdAt,
      who: "db/catalog",
      kind: "db_exercise",
      id: e.id,
      detail: `created "${e.name}"`,
    });
  }

  timeline.sort((a, b) => a.at - b.at);

  const subjectTimeline = timeline.filter(
    (e) => e.who === SUBJECT_EMAIL || e.who === "db/catalog",
  );
  const friction = detectFriction(timeline, SUBJECT_EMAIL);

  const lines = [];
  const log = (s = "") => lines.push(s);

  log("JEREMY POST-AUDIT — full activity timeline");
  log(`Window: since ${cutoff.toISOString()} (${fmtLocal(cutoff)} PT)`);
  log(`Subject: ${SUBJECT_EMAIL}`);
  log("");

  if (friction.length) {
    log("⚠ FRICTION SIGNALS (possible wall / frustration)");
    for (const f of friction) {
      log(`  [${f.severity}] ${f.msg}`);
    }
    log("");
  } else {
    log("✓ No automatic friction signals in this window");
    log("");
  }

  log("── Chronological timeline (Jeremy + catalog DB) ──");
  if (!subjectTimeline.length) {
    log("  (no events — extend MINUTES or set SINCE earlier)");
  } else {
    for (const e of subjectTimeline) {
      const tag =
        e.kind === "click"
          ? "CLICK"
          : e.kind === "page_view"
            ? "VIEW "
            : e.kind === "db_workout"
              ? "SAVE "
              : e.kind.toUpperCase().padEnd(5);
      log(`  ${fmtLocal(e.at)} PT  ${tag}  ${e.path || ""}  ${e.detail}`);
      if (e.kind === "db_workout" && e.exercises?.length && e.who === "db/catalog") {
        log(`           └ ${truncate(exerciseSummary(e.exercises), 90)}`);
      }
    }
  }
  log("");

  log(`── Adult W${WEEK_FOCUS} program (end-of-window snapshot) ──`);
  const program = await prisma.program.findFirst({
    where: { slug: PROGRAM_SLUG },
    include: {
      weeks: {
        where: { weekNumber: WEEK_FOCUS },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
                include: {
                  workout: {
                    select: {
                      id: true,
                      name: true,
                      updatedAt: true,
                      _count: { select: { exercises: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const homeIds = {};
  for (const week of program?.weeks || []) {
    for (const day of week.days) {
      for (const opt of day.options) {
        const w = opt.workout;
        if (!w) continue;
        const touched = w.updatedAt >= cutoff ? " ← touched" : "";
        log(
          `  W${week.weekNumber}D${day.dayNumber} ${opt.label}: ${w.id} "${w.name}" (${w._count.exercises} ex)${touched}`,
        );
        if (opt.label === "Home" && day.dayNumber <= 3) homeIds[day.dayNumber] = w.id;
      }
    }
  }
  log("");
  if (homeIds[1] && homeIds[2] && homeIds[1] === homeIds[2]) {
    log("⚠ W1D1 and W1D2 Home SHARE same workout — bleed risk");
  } else if (homeIds[1] && homeIds[2]) {
    log(`✓ W1D1 Home (${homeIds[1]}) ≠ W1D2 Home (${homeIds[2]})`);
  }
  log("");

  if (INCLUDE_JOHN) {
    const johnEvents = timeline.filter((e) => e.who.includes(JOHN_EMAIL));
    log(`── John / SMS (separate) ──`);
    if (!johnEvents.length) log("  (none)");
    else for (const e of johnEvents) log(`  ${fmtLocal(e.at)} PT  ${e.detail}`);
    log("");
  }

  const report = lines.join("\n");
  console.log(report);

  const csv = [
    "time_pt,who,kind,path,detail",
    ...timeline.map((e) =>
      [
        fmtLocal(e.at),
        e.who,
        e.kind,
        `"${(e.path || "").replace(/"/g, '""')}"`,
        `"${(e.detail || "").replace(/"/g, '""')}"`,
      ].join(","),
    ),
  ].join("\n");

  const base = new URL("./", import.meta.url);
  writeFileSync(new URL(".jeremy-post-audit-latest.txt", base), `${report}\n`, "utf8");
  writeFileSync(new URL(".jeremy-post-audit-timeline.csv", base), `${csv}\n`, "utf8");
  console.error("Saved: scripts/.jeremy-post-audit-latest.txt");
  console.error("Saved: scripts/.jeremy-post-audit-timeline.csv");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});