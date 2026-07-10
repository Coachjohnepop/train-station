#!/usr/bin/env node
/**
 * Reset prod catalog clutter — delete everything not in prisma/seed-data.json,
 * then re-import the seed snapshot (upsert).
 *
 * Does NOT touch users, members, chat, SMS store metadata, enrollments, etc.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/purge-catalog-to-seed-prodtest.mjs
 *   npx tsx scripts/purge-catalog-to-seed-prodtest.mjs
 *   SKIP_REIMPORT=1 npx tsx scripts/purge-catalog-to-seed-prodtest.mjs
 */

import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import {
  importCatalogSnapshot,
  loadCatalogSnapshotFromSeedFile,
} from "../src/lib/import-catalog-snapshot.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const SKIP_REIMPORT = process.env.SKIP_REIMPORT === "1";
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) throw new Error("DATABASE_URL required (.env.go-prod)");
  return url;
}

function ids(rows, key = "id") {
  return new Set((rows || []).map((r) => String(r[key])));
}

async function main() {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  const { snapshot, source } = loadCatalogSnapshotFromSeedFile(seed);

  const seedWorkoutIds = ids(snapshot.workouts);
  const seedExerciseIds = ids(snapshot.exercises);
  const seedWorkoutExerciseIds = ids(snapshot.workoutExercises);
  const seedOptionIds = ids(snapshot.programDayOptions);

  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(resolveDatabaseUrl())),
  });

  const [allWorkouts, allExercises] = await Promise.all([
    prisma.workout.findMany({ select: { id: true, name: true, source: true } }),
    prisma.exercise.findMany({ select: { id: true, name: true } }),
  ]);

  const workoutsToDelete = allWorkouts
    .filter((w) => !seedWorkoutIds.has(w.id))
    .map((w) => w.id);

  const exercisesToDelete = allExercises
    .filter((e) => !seedExerciseIds.has(e.id))
    .map((e) => e.id);

  const extraWorkoutExercises = await prisma.workoutExercise.count({
    where: {
      OR: [
        { workoutId: { in: workoutsToDelete } },
        { id: { notIn: [...seedWorkoutExerciseIds] } },
      ],
    },
  });

  const extraOptions = await prisma.programDayOption.count({
    where: { id: { notIn: [...seedOptionIds] } },
  });

  console.log(`\nPurge catalog to seed${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`Golden source: ${SEED_PATH}`);
  console.log(`  ${snapshot.exercises?.length} exercises, ${snapshot.workouts?.length} workouts`);
  console.log(`\nProd today: ${allWorkouts.length} workouts, ${allExercises.length} exercises`);
  console.log(`Will delete:`);
  console.log(`  ${workoutsToDelete.length} workouts (not in seed — includes all SMS/junk copies)`);
  console.log(`  ${exercisesToDelete.length} exercises (not in seed)`);
  console.log(`  ${extraWorkoutExercises} workout-exercise rows (orphans + extras on kept workouts)`);
  console.log(`  ${extraOptions} program day options (not in seed — e.g. W1D2 Home restore)`);
  console.log(`Then: ${SKIP_REIMPORT ? "SKIP re-import" : `re-import from ${source}`}`);
  console.log("");

  if (DRY_RUN) {
    console.log("DRY_RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  if (workoutsToDelete.length) {
    await prisma.programDayOption.deleteMany({
      where: { workoutId: { in: workoutsToDelete } },
    });
    await prisma.programDay.updateMany({
      where: { workoutId: { in: workoutsToDelete } },
      data: { workoutId: null },
    });
    await prisma.workoutCycleDaySlot.deleteMany({
      where: { workoutId: { in: workoutsToDelete } },
    });
    await prisma.workoutLog.deleteMany({
      where: { workoutId: { in: workoutsToDelete } },
    });
    await prisma.coachTodaySession.deleteMany({
      where: { workoutId: { in: workoutsToDelete } },
    });
    await prisma.liveWorkoutSession.deleteMany({
      where: { workoutId: { in: workoutsToDelete } },
    });
    const wDel = await prisma.workout.deleteMany({
      where: { id: { in: workoutsToDelete } },
    });
    console.log(`Deleted ${wDel.count} workouts`);
  }

  const optDel = await prisma.programDayOption.deleteMany({
    where: { id: { notIn: [...seedOptionIds] } },
  });
  console.log(`Deleted ${optDel.count} program day options`);

  const weDel = await prisma.workoutExercise.deleteMany({
    where: {
      OR: [
        { id: { notIn: [...seedWorkoutExerciseIds] } },
        { exerciseId: { in: exercisesToDelete } },
      ],
    },
  });
  console.log(`Deleted ${weDel.count} workout-exercise rows`);

  if (exercisesToDelete.length) {
    const eDel = await prisma.exercise.deleteMany({
      where: { id: { in: exercisesToDelete } },
    });
    console.log(`Deleted ${eDel.count} exercises`);
  }

  if (!SKIP_REIMPORT) {
    const result = await importCatalogSnapshot(prisma, snapshot, source);
    console.log("Re-imported seed:", result);
  }

  const [wc, ec] = await Promise.all([
    prisma.workout.count(),
    prisma.exercise.count(),
  ]);
  console.log(`\nAfter purge: ${wc} workouts, ${ec} exercises`);
  console.log("Done.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});