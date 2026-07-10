#!/usr/bin/env node
/**
 * Remove deleltetesing delete-loop test data from the database.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-deleltetesing.mjs
 *   node scripts/cleanup-deleltetesing.mjs
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
const MARKER = process.env.TEST_MARKER || "deleltetesing";
const scriptDir = dirname(fileURLToPath(import.meta.url));

function loadManifestIds() {
  const workoutIds = new Set();
  for (const name of readdirSync(scriptDir)) {
    if (!name.startsWith(".deleltetesing-manifest-") || !name.endsWith(".json")) continue;
    const m = JSON.parse(readFileSync(join(scriptDir, name), "utf8"));
    for (const w of m.created?.workouts || []) workoutIds.add(w.id);
  }
  return [...workoutIds];
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

  const manifestIds = loadManifestIds();
  const markerWorkouts = await prisma.workout.findMany({
    where: { name: { contains: MARKER, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const allWorkoutIds = [...new Set([...manifestIds, ...markerWorkouts.map((w) => w.id)])];

  console.log(`deleltetesing cleanup — workouts to delete: ${allWorkoutIds.length}`);
  for (const w of markerWorkouts) console.log(`  · ${w.name}`);

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

  const logDel = await prisma.workoutLog.deleteMany({
    where: { workoutId: { in: allWorkoutIds } },
  });
  console.log(`Deleted ${logDel.count} WorkoutLog rows`);

  const workoutDel = await prisma.workout.deleteMany({
    where: { id: { in: allWorkoutIds } },
  });
  console.log(`Deleted ${workoutDel.count} Workout rows`);

  const remaining = await prisma.workout.count({
    where: { name: { contains: MARKER, mode: "insensitive" } },
  });
  console.log(`Remaining ${MARKER} workouts: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});