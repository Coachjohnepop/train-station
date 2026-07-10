#!/usr/bin/env node
/**
 * List exercises used in prod workouts and which workouts reference them.
 *
 * Usage:
 *   npx tsx scripts/exercise-usage-report-prodtest.mjs
 *
 * Outputs:
 *   scripts/.exercise-usage-report-prod.txt / .csv        — all workouts
 *   scripts/.exercise-usage-report-prod-program.txt / .csv — Adult W1–W2 program only
 */

import dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { isJunkWorkoutName } from "../src/lib/programs.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const WEEK_MIN = Number(process.env.WEEK_MIN || "1");
const WEEK_MAX = Number(process.env.WEEK_MAX || "2");

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) throw new Error("DATABASE_URL required");
  return url;
}

function isSmsWorkout(id, source) {
  return source === "sms" || id.startsWith("sms-w-");
}

function buildReport({ title, sorted, slotCount, unusedCount }) {
  const lines = [];
  lines.push(title);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Exercises in use: ${sorted.length}`);
  lines.push(`Workout-exercise slots: ${slotCount}`);
  lines.push("");
  lines.push("=".repeat(72));
  lines.push("");

  for (const ex of sorted) {
    lines.push(ex.name.toUpperCase());
    const workouts = [...ex.workouts.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    for (const w of workouts) {
      const slots = w.slots > 1 ? ` — ${w.slots} slots in this workout` : "";
      lines.push(`  • ${w.name}${slots}`);
      const unique = [...new Set(w.programs)].sort();
      for (const prog of unique) {
        lines.push(`      ↳ ${prog}`);
      }
    }
    lines.push("");
  }

  lines.push("=".repeat(72));
  if (unusedCount !== null) {
    lines.push(`Exercises NOT used in this scope: ${unusedCount}`);
  }
  return lines.join("\n");
}

function buildCsv(sorted) {
  const csvRows = ["exercise,workout,workout_id,program_slots,slot_count"];
  for (const ex of sorted) {
    for (const w of [...ex.workouts.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )) {
      const programs = [...new Set(w.programs)].sort().join("; ") || "";
      const workoutName = w.name.replace(/"/g, '""');
      const exName = ex.name.replace(/"/g, '""');
      csvRows.push(
        `"${exName}","${workoutName}","${w.id}","${programs.replace(/"/g, '""')}",${w.slots}`,
      );
    }
  }
  return `${csvRows.join("\n")}\n`;
}

function aggregate(rows, programByWorkout, allowedWorkoutIds) {
  const filtered = allowedWorkoutIds
    ? rows.filter((r) => allowedWorkoutIds.has(r.workoutId))
    : rows;

  const byExercise = new Map();
  for (const r of filtered) {
    const key = r.exerciseId;
    if (!byExercise.has(key)) {
      byExercise.set(key, { name: r.exercise.name, workouts: new Map() });
    }
    const entry = byExercise.get(key);
    const wkey = r.workoutId;
    if (!entry.workouts.has(wkey)) {
      entry.workouts.set(wkey, {
        id: r.workout.id,
        name: r.workout.name,
        source: r.workout.source,
        slots: 0,
        programs: programByWorkout.get(wkey) ?? [],
      });
    }
    entry.workouts.get(wkey).slots++;
  }

  return {
    sorted: [...byExercise.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    ),
    slotCount: filtered.length,
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(resolveDatabaseUrl())),
  });

  const [rows, programOptions, programDays] = await Promise.all([
    prisma.workoutExercise.findMany({
      orderBy: [{ exercise: { name: "asc" } }, { workout: { name: "asc" } }],
      select: {
        workoutId: true,
        exerciseId: true,
        exercise: { select: { name: true } },
        workout: { select: { name: true, source: true, id: true } },
      },
    }),
    prisma.programDayOption.findMany({
      where: {
        day: {
          week: {
            weekNumber: { gte: WEEK_MIN, lte: WEEK_MAX },
            program: { slug: PROGRAM_SLUG },
          },
        },
      },
      select: {
        workoutId: true,
        label: true,
        day: {
          select: {
            dayNumber: true,
            week: { select: { weekNumber: true, program: { select: { slug: true, name: true } } } },
          },
        },
      },
    }),
    prisma.programDay.findMany({
      where: {
        week: {
          weekNumber: { gte: WEEK_MIN, lte: WEEK_MAX },
          program: { slug: PROGRAM_SLUG },
        },
        workoutId: { not: null },
      },
      select: {
        workoutId: true,
        dayNumber: true,
        week: { select: { weekNumber: true, program: { select: { slug: true, name: true } } } },
      },
    }),
  ]);

  const [allOptions, allDays] = await Promise.all([
    prisma.programDayOption.findMany({
      select: {
        workoutId: true,
        label: true,
        day: {
          select: {
            dayNumber: true,
            week: { select: { weekNumber: true, program: { select: { slug: true, name: true } } } },
          },
        },
      },
    }),
    prisma.programDay.findMany({
      where: { workoutId: { not: null } },
      select: {
        workoutId: true,
        dayNumber: true,
        week: { select: { weekNumber: true, program: { select: { slug: true, name: true } } } },
      },
    }),
  ]);

  function linkPrograms(links, days) {
    const programByWorkout = new Map();
    const add = (workoutId, label) => {
      if (!workoutId) return;
      const list = programByWorkout.get(workoutId) ?? [];
      list.push(label);
      programByWorkout.set(workoutId, list);
    };
    for (const link of links) {
      const p = link.day.week.program;
      add(link.workoutId, `${p.name || p.slug} W${link.day.week.weekNumber}D${link.day.dayNumber} ${link.label}`);
    }
    for (const day of days) {
      if (!day.workoutId) continue;
      const p = day.week.program;
      add(day.workoutId, `${p.name || p.slug} W${day.week.weekNumber}D${day.dayNumber} Standard`);
    }
    return programByWorkout;
  }

  const programByWorkoutAll = linkPrograms(allOptions, allDays);
  const programByWorkoutScoped = linkPrograms(programOptions, programDays);

  const programWorkoutMeta = await prisma.workout.findMany({
    where: { id: { in: [...programByWorkoutScoped.keys()] } },
    select: { id: true, name: true, source: true },
  });

  const programWorkoutIds = new Set();
  for (const w of programWorkoutMeta) {
    if (isSmsWorkout(w.id, w.source)) continue;
    if (isJunkWorkoutName(w.name)) continue;
    programWorkoutIds.add(w.id);
  }

  const full = aggregate(rows, programByWorkoutAll, null);
  const program = aggregate(rows, programByWorkoutScoped, programWorkoutIds);

  const unusedAll = await prisma.exercise.count({
    where: { workoutItems: { none: {} } },
  });

  const usedInProgram = new Set(
    rows.filter((r) => programWorkoutIds.has(r.workoutId)).map((r) => r.exerciseId),
  );
  const totalExercises = await prisma.exercise.count();
  const unusedInProgram = totalExercises - usedInProgram.size;

  const fullReport = buildReport({
    title: "EXERCISE USAGE REPORT — The Train Station (prod, all workouts)",
    sorted: full.sorted,
    slotCount: full.slotCount,
    unusedCount: unusedAll,
  });

  const programReport = buildReport({
    title: `EXERCISE USAGE REPORT — ${PROGRAM_SLUG} program W${WEEK_MIN}–W${WEEK_MAX} only (no SMS/junk)`,
    sorted: program.sorted,
    slotCount: program.slotCount,
    unusedCount: unusedInProgram,
  });

  const base = new URL("./", import.meta.url);
  writeFileSync(new URL(".exercise-usage-report-prod.txt", base), `${fullReport}\n`, "utf8");
  writeFileSync(new URL(".exercise-usage-report-prod.csv", base), buildCsv(full.sorted), "utf8");
  writeFileSync(new URL(".exercise-usage-report-prod-program.txt", base), `${programReport}\n`, "utf8");
  writeFileSync(new URL(".exercise-usage-report-prod-program.csv", base), buildCsv(program.sorted), "utf8");

  console.log(programReport);
  console.error("\nSaved program report:");
  console.error("  scripts/.exercise-usage-report-prod-program.txt");
  console.error("  scripts/.exercise-usage-report-prod-program.csv");
  console.error("Full catalog also updated:");
  console.error("  scripts/.exercise-usage-report-prod.txt");
  console.error("  scripts/.exercise-usage-report-prod.csv");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});