#!/usr/bin/env node
/**
 * Live monitor — polls Postgres for program builder edits on prod.
 * Cannot see browser/keystrokes; reports workout + exercise changes ~8s after save.
 *
 * Usage:
 *   npx tsx scripts/monitor-jeremy-program-prodtest.mjs
 *   POLL_MS=5000 DURATION_MIN=30 npx tsx scripts/monitor-jeremy-program-prodtest.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const POLL_MS = Number(process.env.POLL_MS || "8000");
const DURATION_MIN = Number(process.env.DURATION_MIN || "45");
const WEEK_FOCUS = Number(process.env.WEEK_FOCUS || "1");

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) throw new Error("DATABASE_URL required");
  return url;
}

function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function exerciseSummary(exercises) {
  return exercises
    .map((e, i) => `${i + 1}.${e.exercise?.name || "?"}(${e.sets ?? "?"}x${e.reps ?? "?"})`)
    .join(" · ");
}

async function snapshot(prisma) {
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
                    include: {
                      exercises: {
                        orderBy: { sortOrder: "asc" },
                        include: { exercise: { select: { name: true } } },
                      },
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

  const recentWorkouts = await prisma.workout.findMany({
    where: { updatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      _count: { select: { exercises: true } },
    },
  });

  const dayMap = new Map();
  for (const week of program?.weeks || []) {
    for (const day of week.days) {
      const opts = {};
      for (const o of day.options) {
        const key = o.label || `opt${o.sortOrder}`;
        opts[key] = {
          optionId: o.id,
          workoutId: o.workoutId,
          workoutName: o.workout?.name,
          workoutUpdated: o.workout?.updatedAt?.toISOString(),
          exerciseCount: o.workout?.exercises?.length ?? 0,
          exercises: exerciseSummary(o.workout?.exercises || []),
        };
      }
      dayMap.set(`W${week.weekNumber}D${day.dayNumber}`, opts);
    }
  }

  return { dayMap, recentWorkouts, at: Date.now() };
}

function diffDays(prev, next) {
  const events = [];
  for (const [dayKey, nextOpts] of next.dayMap) {
    const prevOpts = prev?.dayMap?.get(dayKey) || {};
    for (const [label, n] of Object.entries(nextOpts)) {
      const p = prevOpts[label];
      if (!p) {
        events.push({ dayKey, label, type: "new-option", detail: n.workoutId });
        continue;
      }
      if (p.workoutId !== n.workoutId) {
        events.push({
          dayKey,
          label,
          type: "workout-swapped",
          detail: `${p.workoutId} → ${n.workoutId} (${n.workoutName})`,
        });
      } else if (p.exerciseCount !== n.exerciseCount) {
        events.push({
          dayKey,
          label,
          type: "exercise-count",
          detail: `${p.exerciseCount} → ${n.exerciseCount}`,
        });
      } else if (p.exercises !== n.exercises) {
        events.push({
          dayKey,
          label,
          type: "exercises-changed",
          detail: n.exercises,
        });
      } else if (p.workoutUpdated !== n.workoutUpdated) {
        events.push({
          dayKey,
          label,
          type: "workout-metadata",
          detail: `${n.workoutName} updated`,
        });
      }
    }
  }
  return events;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(resolveDatabaseUrl())),
  });

  const endAt = Date.now() + DURATION_MIN * 60 * 1000;
  let prev = null;

  console.log(`\n══ Jeremy program monitor [prodtest] ══`);
  console.log(`Program: ${PROGRAM_SLUG} · Week ${WEEK_FOCUS} focus`);
  console.log(`Poll: every ${POLL_MS / 1000}s · ${DURATION_MIN} min`);
  console.log(`Note: DB-side only — no screen/keystroke visibility\n`);

  while (Date.now() < endAt) {
    try {
      const snap = await snapshot(prisma);
      if (prev) {
        const events = diffDays(prev, snap);
        for (const e of events) {
          console.log(`[${ts()}] ${e.dayKey} ${e.label} — ${e.type}: ${e.detail}`);
        }
        const prevRecent = new Set((prev.recentWorkouts || []).map((w) => `${w.id}:${w.updatedAt}`));
        for (const w of snap.recentWorkouts) {
          const key = `${w.id}:${w.updatedAt}`;
          if (!prevRecent.has(key) && w.updatedAt > new Date(prev.at)) {
            console.log(
              `[${ts()}] workout touched: ${w.id} "${w.name}" (${w._count.exercises} ex) @ ${w.updatedAt.toISOString()}`,
            );
          }
        }
      } else {
        console.log(`[${ts()}] baseline loaded — watching for changes…\n`);
        for (const [dayKey, opts] of snap.dayMap) {
          for (const [label, o] of Object.entries(opts)) {
            console.log(
              `  ${dayKey} ${label}: ${o.workoutId} (${o.exerciseCount} ex) — ${o.exercises.slice(0, 100)}${o.exercises.length > 100 ? "…" : ""}`,
            );
          }
        }
        console.log("");
      }
      prev = snap;
    } catch (e) {
      console.error(`[${ts()}] poll error:`, e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  console.log(`\n[${ts()}] monitor ended.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});