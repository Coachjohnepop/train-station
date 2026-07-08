#!/usr/bin/env node
/**
 * Remove QA / smoke-test rows left on production (S1, S1B, S2, JEREMY-LOOP, etc.).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-qa-test-data.mjs
 *   node scripts/cleanup-qa-test-data.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const WORKOUT_MARKERS = [
  "s1b-workout-",
  "s2-",
  "prog-order-",
  "jerdog",
  "testingsilly",
  "qa jeremy-loop",
  "jeremy-loop",
];

const EXERCISE_MARKERS = [
  "s1-temp-",
  "s1b-",
  "s1b-patched-",
  "s1b-note-",
  "jerdog",
  "testingsilly",
  "qa jeremy-loop",
  "jeremy-loop",
];

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

function matchesMarker(name, markers) {
  const lower = (name || "").toLowerCase();
  return markers.some((m) => lower.includes(m));
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const allWorkouts = await prisma.workout.findMany({
    select: { id: true, name: true },
  });
  const markerWorkouts = allWorkouts.filter((w) => matchesMarker(w.name, WORKOUT_MARKERS));

  const allExercises = await prisma.exercise.findMany({
    select: { id: true, name: true, tags: true, description: true },
  });
  const markerExercises = allExercises.filter(
    (e) =>
      matchesMarker(e.name, EXERCISE_MARKERS) ||
      matchesMarker(e.tags, EXERCISE_MARKERS) ||
      matchesMarker(e.description, EXERCISE_MARKERS) ||
      (e.tags || "").toLowerCase() === "qa",
  );

  const workoutIds = markerWorkouts.map((w) => w.id);
  const exerciseIds = markerExercises.map((e) => e.id);

  console.log(`QA cleanup — workouts: ${workoutIds.length}, exercises: ${exerciseIds.length}`);
  for (const w of markerWorkouts) console.log("  workout:", w.name);
  for (const e of markerExercises) console.log("  exercise:", e.name);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  if (workoutIds.length) {
    await prisma.workoutCycleDaySlot.deleteMany({ where: { workoutId: { in: workoutIds } } });
    await prisma.programDayOption.deleteMany({ where: { workoutId: { in: workoutIds } } });
    await prisma.programDay.updateMany({
      where: { workoutId: { in: workoutIds } },
      data: { workoutId: null },
    });
    await prisma.workoutLog.deleteMany({ where: { workoutId: { in: workoutIds } } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: workoutIds } } });
    const deleted = await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
    console.log(`Deleted ${deleted.count} workouts`);
  }

  if (exerciseIds.length) {
    await prisma.workoutExercise.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
    const deleted = await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
    console.log(`Deleted ${deleted.count} exercises`);
  }

  await prisma.$disconnect();
  await pool.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});