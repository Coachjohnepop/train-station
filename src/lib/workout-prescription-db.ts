import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { WorkoutSetPhaseInput } from "@/lib/workout-prescription";

let structuredReadyCache: boolean | null = null;

export async function structuredPrescriptionReady(
  prisma: PrismaClient,
): Promise<boolean> {
  if (structuredReadyCache !== null) return structuredReadyCache;
  try {
    const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'WorkoutSetPhase'
      ) AS exists`,
    );
    structuredReadyCache = Boolean(rows[0]?.exists);
  } catch {
    structuredReadyCache = false;
  }
  return structuredReadyCache;
}

export type WorkoutExerciseCreateInput = {
  exerciseId: string;
  sortOrder: number;
  setScheme: string;
  reps: string | null;
  sets: number | null;
  weightTier: string;
  notes: string | null;
  setCount?: number;
  restBetweenSetsSec?: number | null;
  phases?: WorkoutSetPhaseInput[];
};

export function buildWorkoutExerciseCreateData(
  item: WorkoutExerciseCreateInput,
  structured: boolean,
) {
  const base = {
    exerciseId: item.exerciseId,
    sortOrder: item.sortOrder,
    setScheme: item.setScheme,
    reps: item.reps,
    sets: item.sets,
    weightTier: item.weightTier,
    notes: item.notes,
  };

  if (!structured || !item.phases?.length) {
    return base;
  }

  return {
    ...base,
    setCount: item.setCount ?? item.sets,
    restBetweenSetsSec: item.restBetweenSetsSec ?? null,
    phases: {
      create: item.phases.map((phase) => ({
        phaseIndex: phase.phaseIndex,
        phaseType: phase.phaseType,
        durationSec: phase.durationSec ?? null,
        reps: phase.reps ?? null,
        repKind: phase.repKind ?? "FIXED",
        positionCue: phase.positionCue ?? null,
      })),
    },
  };
}