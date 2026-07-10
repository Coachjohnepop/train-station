#!/usr/bin/env node
/**
 * Remove testingsilly coach-loop test data from the database.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-testingsilly.mjs
 *   node scripts/cleanup-testingsilly.mjs
 */

import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const MARKER = "testingsilly";

const scriptDir = dirname(fileURLToPath(import.meta.url));

function loadManifestIds() {
  const workoutIds = new Set();
  const exerciseIds = new Set();
  const dayOffIds = new Set();

  for (const name of readdirSync(scriptDir)) {
    if (!name.startsWith(".testingsilly-manifest-") || !name.endsWith(".json")) continue;
    const m = JSON.parse(readFileSync(join(scriptDir, name), "utf8"));
    for (const w of m.created.workouts || []) workoutIds.add(w.id);
    for (const e of m.created.exercises || []) exerciseIds.add(e);
    for (const d of m.created.programDays || []) {
      if (d.off) dayOffIds.add(d.dayId);
    }
  }
  return { workoutIds: [...workoutIds], exerciseIds: [...exerciseIds], dayOffIds: [...dayOffIds] };
}

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("DATABASE_URL must be a real Postgres URL (.env.go-prod)");
  }
  return url;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const { workoutIds, exerciseIds, dayOffIds } = loadManifestIds();

  const markerWorkouts = await prisma.workout.findMany({
    where: { name: { contains: MARKER, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const allWorkoutIds = [...new Set([...workoutIds, ...markerWorkouts.map((w) => w.id)])];

  const markerExercises = await prisma.exercise.findMany({
    where: { name: { contains: MARKER, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const allExerciseIds = [...new Set([...exerciseIds, ...markerExercises.map((e) => e.id)])];

  console.log(`Workouts to delete: ${allWorkoutIds.length}`);
  console.log(`Exercises to delete: ${allExerciseIds.length}`);
  console.log(`Day Off days to clear notes: ${dayOffIds.length}`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  const optionDel = await prisma.programDayOption.deleteMany({
    where: { workoutId: { in: allWorkoutIds } },
  });
  console.log(`Deleted ${optionDel.count} ProgramDayOption rows`);

  const dayClear = await prisma.programDay.updateMany({
    where: { workoutId: { in: allWorkoutIds } },
    data: { workoutId: null },
  });
  console.log(`Cleared workoutId on ${dayClear.count} ProgramDay rows`);

  const offNotes = await prisma.programDay.updateMany({
    where: {
      id: { in: dayOffIds },
      notes: { contains: MARKER, mode: "insensitive" },
    },
    data: { notes: null },
  });
  console.log(`Cleared notes on ${offNotes.count} Day Off rows`);

  const logDel = await prisma.workoutLog.deleteMany({
    where: { workoutId: { in: allWorkoutIds } },
  });
  console.log(`Deleted ${logDel.count} WorkoutLog rows`);

  const workoutDel = await prisma.workout.deleteMany({
    where: { id: { in: allWorkoutIds } },
  });
  console.log(`Deleted ${workoutDel.count} Workout rows`);

  const exerciseDel = await prisma.exercise.deleteMany({
    where: { id: { in: allExerciseIds } },
  });
  console.log(`Deleted ${exerciseDel.count} Exercise rows`);

  const remaining = await prisma.workout.count({
    where: { name: { contains: MARKER, mode: "insensitive" } },
  });
  console.log(`Remaining testingsilly workouts: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});