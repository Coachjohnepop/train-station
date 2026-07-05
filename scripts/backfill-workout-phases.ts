#!/usr/bin/env npx tsx
/**
 * Backfill WorkoutSetPhase rows from legacy WorkoutExercise flat fields.
 *
 * Usage:
 *   DRY_RUN=1 WORKOUT_ID=cmr6okj25000004jlh7a4bdlu npx tsx scripts/backfill-workout-phases.ts
 *   WORKOUT_ID=cmr6okj25000004jlh7a4bdlu npx tsx scripts/backfill-workout-phases.ts
 *   DRY_RUN=1 npx tsx scripts/backfill-workout-phases.ts   # all workouts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.production", override: true });

import {
  inferWorkoutPrescriptions,
  type LegacyWorkoutExerciseRow,
} from "../src/lib/workout-prescription-backfill";
import { formatPrescriptionPhases } from "../src/lib/workout-prescription";

const DRY_RUN = process.env.DRY_RUN !== "0";
const WORKOUT_ID = process.env.WORKOUT_ID?.trim() || "";
const LIMIT = Number(process.env.LIMIT || "0");

function resolveConnectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? "";
  const pooled =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  return (
    direct ||
    (database && !database.includes("dummy") ? database : "") ||
    pooled
  );
}

async function tableExists(prisma: any, table: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      table,
    );
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error("No Postgres URL — set POSTGRES_PRISMA_URL in .env.vercel.production");
    process.exit(1);
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { createPgPool } = await import("../src/lib/pg-connection");

  const adapter = new PrismaPg(createPgPool(connectionString));
  const prisma = new PrismaClient({ adapter });

  const hasPhaseTable = await tableExists(prisma, "WorkoutSetPhase");
  if (!hasPhaseTable && !DRY_RUN) {
    console.error(
      "WorkoutSetPhase table missing — run migration 20260704190000_workout_set_phases first",
    );
    process.exit(1);
  }

  const workouts = await prisma.workout.findMany({
    where: WORKOUT_ID ? { id: WORKOUT_ID } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: LIMIT > 0 ? LIMIT : undefined,
  });

  if (workouts.length === 0) {
    console.error("No workouts matched");
    process.exit(1);
  }

  console.log(
    `\nBackfill workout phases ${DRY_RUN ? "(DRY RUN)" : "(APPLY)"}${hasPhaseTable ? "" : " — table not deployed, parse-only"}\n`,
  );

  let itemsProcessed = 0;
  let itemsSkipped = 0;
  let phasesWritten = 0;

  for (const workout of workouts) {
    console.log(`── ${workout.name} (${workout.id})`);

    const items = await prisma.workoutExercise.findMany({
      where: { workoutId: workout.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        sets: true,
        reps: true,
        restSec: true,
        notes: true,
        setScheme: true,
        exercise: { select: { name: true } },
        ...(hasPhaseTable
          ? { phases: { orderBy: { phaseIndex: "asc" } } }
          : {}),
      },
    });

    const legacyRows: Array<LegacyWorkoutExerciseRow & { id: string }> = items.map(
      (item) => ({
        id: item.id,
        sets: item.sets,
        reps: item.reps,
        restSec: item.restSec,
        notes: item.notes,
        setScheme: item.setScheme,
        exerciseName: item.exercise.name,
      }),
    );

    const inferred = inferWorkoutPrescriptions(legacyRows);

    for (const item of items) {
      const existingPhases = (item as { phases?: unknown[] }).phases;
      if (existingPhases && existingPhases.length > 0) {
        console.log(`  ⏭ ${item.exercise.name} — already has phases`);
        itemsSkipped += 1;
        continue;
      }

      const plan = inferred.find((r) => r.id === item.id);
      if (!plan) {
        console.log(`  ⚠ ${item.exercise.name} — could not infer`);
        itemsSkipped += 1;
        continue;
      }

      const { prescription, pattern, summary } = plan;
      console.log(
        `  • ${item.exercise.name} [${pattern}] — ${summary}`,
      );
      if (prescription.restBetweenSetsSec != null) {
        console.log(`      rest: ${prescription.restBetweenSetsSec}s`);
      }
      if (prescription.notes) {
        console.log(`      notes: ${prescription.notes}`);
      }
      for (const phase of prescription.phases) {
        console.log(
          `      phase ${phase.phaseIndex}: ${formatPrescriptionPhases({ setCount: 1, phases: [phase] })}`,
        );
      }

      itemsProcessed += 1;

      if (DRY_RUN || !hasPhaseTable) continue;

      await prisma.$transaction(async (tx) => {
        await tx.workoutExercise.update({
          where: { id: item.id },
          data: {
            setCount: prescription.setCount,
            restBetweenSetsSec: prescription.restBetweenSetsSec,
            notes: prescription.notes,
          },
        });

        if (prescription.phases.length > 0) {
          await tx.workoutSetPhase.createMany({
            data: prescription.phases.map((phase) => ({
              workoutExerciseId: item.id,
              phaseIndex: phase.phaseIndex,
              phaseType: phase.phaseType,
              durationSec: phase.durationSec ?? null,
              reps: phase.reps ?? null,
              repKind: phase.repKind ?? "FIXED",
              positionCue: phase.positionCue ?? null,
            })),
          });
          phasesWritten += prescription.phases.length;
        }
      });
    }

    console.log("");
  }

  console.log("Summary:");
  console.log(`  Workouts: ${workouts.length}`);
  console.log(`  Items processed: ${itemsProcessed}`);
  console.log(`  Items skipped: ${itemsSkipped}`);
  console.log(`  Phases written: ${phasesWritten}`);
  if (DRY_RUN) {
    console.log("\nRe-run with DRY_RUN=0 to apply (after migration is deployed).\n");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});