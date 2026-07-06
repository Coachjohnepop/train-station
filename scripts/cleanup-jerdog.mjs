#!/usr/bin/env node
/**
 * Remove all jerdog soak-test rows from production database.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/cleanup-jerdog.mjs
 *   npx tsx scripts/cleanup-jerdog.mjs
 */

import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const MARKER = (process.env.TEST_MARKER || "jerdog").toLowerCase();

function loadManifestIds() {
  const workoutIds = new Set();
  const exerciseIds = new Set();
  const scriptsDir = new URL(".", import.meta.url).pathname;
  for (const file of readdirSync(scriptsDir)) {
    if (!file.startsWith(".jerdog-manifest-") || !file.endsWith(".json")) continue;
    try {
      const m = JSON.parse(readFileSync(`${scriptsDir}/${file}`, "utf8"));
      for (const w of m.created?.workouts || []) workoutIds.add(w.id);
      for (const e of m.created?.exercises || []) exerciseIds.add(e);
    } catch {
      // skip corrupt manifest
    }
  }
  return { workoutIds: [...workoutIds], exerciseIds: [...exerciseIds] };
}

async function main() {
  const pool = createPgPool(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const fromManifest = loadManifestIds();

  const markerWorkouts = await prisma.workout.findMany({
    where: { name: { contains: MARKER, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const markerExercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { name: { contains: MARKER, mode: "insensitive" } },
        { tags: { contains: MARKER, mode: "insensitive" } },
        { description: { contains: MARKER, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  const allWorkoutIds = [
    ...new Set([...fromManifest.workoutIds, ...markerWorkouts.map((w) => w.id)]),
  ];
  const allExerciseIds = [
    ...new Set([...fromManifest.exerciseIds, ...markerExercises.map((e) => e.id)]),
  ];

  console.log(`jerdog cleanup — workouts: ${allWorkoutIds.length}, exercises: ${allExerciseIds.length}`);
  for (const w of markerWorkouts) console.log("  workout:", w.name);
  for (const e of markerExercises) console.log("  exercise:", e.name);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  if (allWorkoutIds.length) {
    await prisma.workoutCycleDaySlot.deleteMany({ where: { workoutId: { in: allWorkoutIds } } });
    await prisma.programDayOption.deleteMany({ where: { workoutId: { in: allWorkoutIds } } });
    await prisma.programDay.updateMany({
      where: { workoutId: { in: allWorkoutIds } },
      data: { workoutId: null },
    });
    await prisma.workoutLog.deleteMany({ where: { workoutId: { in: allWorkoutIds } } });
    await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: allWorkoutIds } } });
    const deleted = await prisma.workout.deleteMany({ where: { id: { in: allWorkoutIds } } });
    console.log(`Deleted ${deleted.count} workouts`);
  }

  if (allExerciseIds.length) {
    await prisma.workoutExercise.deleteMany({ where: { exerciseId: { in: allExerciseIds } } });
    const deleted = await prisma.exercise.deleteMany({ where: { id: { in: allExerciseIds } } });
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