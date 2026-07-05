/**
 * Apply WorkoutSetPhase migration SQL to production Postgres.
 * Usage: npx tsx scripts/apply-prescription-migration.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection";

dotenv.config({ path: ".env.vercel.production", override: true });

const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;
if (!url || url.includes("dummy")) {
  console.error("No real Postgres URL in .env.vercel.production");
  process.exit(1);
}

const sqlPath = join(
  process.cwd(),
  "prisma/migrations/20260704190000_workout_set_phases/migration.sql",
);
const sql = readFileSync(sqlPath, "utf8");

const prisma = new PrismaClient({ adapter: new PrismaPg(createPgPool(url)) });

async function main() {
  console.log("Applying prescription migration…\n");

  const statements = [
    `CREATE TYPE "SetPhaseType" AS ENUM ('HOLD', 'REPS', 'BURNOUT', 'TIMED')`,
    `CREATE TYPE "RepKind" AS ENUM ('FIXED', 'BURNOUT', 'MAX')`,
    `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "setCount" INTEGER`,
    `ALTER TABLE "WorkoutExercise" ADD COLUMN IF NOT EXISTS "restBetweenSetsSec" INTEGER`,
    `UPDATE "WorkoutExercise" SET "setCount" = "sets" WHERE "setCount" IS NULL AND "sets" IS NOT NULL`,
    `UPDATE "WorkoutExercise" SET "restBetweenSetsSec" = "restSec" WHERE "restBetweenSetsSec" IS NULL AND "restSec" IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS "WorkoutSetPhase" (
      "id" TEXT NOT NULL,
      "workoutExerciseId" TEXT NOT NULL,
      "phaseIndex" INTEGER NOT NULL,
      "phaseType" "SetPhaseType" NOT NULL,
      "durationSec" INTEGER,
      "reps" INTEGER,
      "repKind" "RepKind" NOT NULL DEFAULT 'FIXED',
      "positionCue" TEXT,
      CONSTRAINT "WorkoutSetPhase_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutSetPhase_workoutExerciseId_phaseIndex_key"
      ON "WorkoutSetPhase"("workoutExerciseId", "phaseIndex")`,
    `CREATE INDEX IF NOT EXISTS "WorkoutSetPhase_workoutExerciseId_idx"
      ON "WorkoutSetPhase"("workoutExerciseId")`,
    `DO $$ BEGIN
      ALTER TABLE "WorkoutSetPhase"
        ADD CONSTRAINT "WorkoutSetPhase_workoutExerciseId_fkey"
        FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$`,
  ];

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`✅ ${preview}…`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`○ skip (exists) — ${preview}…`);
      } else {
        console.error(`❌ ${preview}…`);
        console.error(msg);
        process.exit(1);
      }
    }
  }

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name='WorkoutSetPhase'`,
  );
  console.log("\nWorkoutSetPhase table:", tables);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });