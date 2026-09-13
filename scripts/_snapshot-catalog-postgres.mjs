#!/usr/bin/env node
/**
 * Snapshot Jeremy's catalog (programs, workouts, exercises) from live Postgres.
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

const OUT_DIR =
  process.env.CATALOG_SNAPSHOT_DIR ||
  "/Users/johnpopham/Desktop/Stuff/Lemon Voice/The Train Station/backups";

async function main() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
  if (!url || url.includes("dummy")) {
    console.error("No real Postgres URL");
    process.exit(1);
  }
  const pool = createPgPool(url);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const [
    programs,
    weeks,
    days,
    sessions,
    options,
    workouts,
    workoutExercises,
    workoutSetPhases,
    exercises,
  ] = await Promise.all([
    prisma.program.findMany(),
    prisma.programWeek.findMany(),
    prisma.programDay.findMany(),
    prisma.programDaySession.findMany(),
    prisma.programDayOption.findMany(),
    prisma.workout.findMany(),
    prisma.workoutExercise.findMany(),
    prisma.workoutSetPhase.findMany(),
    prisma.exercise.findMany(),
  ]);

  const payload = {
    at: new Date().toISOString(),
    host: "train-station-catalog",
    counts: {
      programs: programs.length,
      weeks: weeks.length,
      days: days.length,
      sessions: sessions.length,
      options: options.length,
      workouts: workouts.length,
      workoutExercises: workoutExercises.length,
      workoutSetPhases: workoutSetPhases.length,
      exercises: exercises.length,
    },
    programs,
    weeks,
    days,
    sessions,
    options,
    workouts,
    workoutExercises,
    workoutSetPhases,
    exercises,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(OUT_DIR, `catalog-${stamp}.json.gz`);
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(payload))));
  console.log("wrote", file);
  console.log("counts", payload.counts);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
