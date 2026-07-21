import "server-only";

import type {
  SmsWorkoutExerciseRecord,
  SmsWorkoutRecord,
  SmsWorkoutStore,
} from "@/lib/sms-workouts-types";
import { prisma } from "@/lib/prisma";

function rowToWorkout(row: {
  id: string;
  name: string;
  description: string | null;
  source: string;
  restTimerEnabled: boolean;
  restTimerSeconds: number | null;
  restTimerSound?: string | null;
  exportText: string | null;
  certifiedAt: Date | null;
  createdAt: Date;
}): SmsWorkoutRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    source: "sms",
    createdAt: row.createdAt.toISOString(),
    restTimerEnabled: row.restTimerEnabled,
    restTimerSeconds: row.restTimerSeconds ?? undefined,
    restTimerSound: row.restTimerSound ?? undefined,
    exportText: row.exportText,
    certifiedAt: row.certifiedAt?.toISOString() ?? null,
  };
}

function rowToWorkoutExercise(row: {
  id: string;
  workoutId: string;
  exerciseId: string;
  blockName: string | null;
  sortOrder: number;
  sets: number | null;
  reps: string | null;
  notes: string | null;
  setScheme: string | null;
  weightTier: string | null;
}): SmsWorkoutExerciseRecord {
  return {
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    blockName: row.blockName,
    sortOrder: row.sortOrder,
    sets: row.sets,
    reps: row.reps,
    notes: row.notes,
    setScheme: row.setScheme,
    weightTier: row.weightTier,
  };
}

export async function loadSmsWorkoutsFromDb(): Promise<SmsWorkoutStore> {
  const rows = await prisma.workout.findMany({
    where: { source: "sms" },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const workouts: SmsWorkoutRecord[] = [];
  const workoutExercises: SmsWorkoutExerciseRecord[] = [];

  for (const row of rows) {
    workouts.push(rowToWorkout(row));
    for (const exercise of row.exercises) {
      workoutExercises.push(rowToWorkoutExercise(exercise));
    }
  }

  return { workouts, workoutExercises };
}

export async function persistSmsWorkoutStoreToDb(store: SmsWorkoutStore): Promise<void> {
  const smsIds = new Set(store.workouts.map((w) => w.id));

  await prisma.$transaction(async (tx) => {
    const existing = await tx.workout.findMany({
      where: { source: "sms" },
      select: { id: true },
    });
    const toDelete = existing.map((w) => w.id).filter((id) => !smsIds.has(id));
    if (toDelete.length > 0) {
      await tx.workout.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (const workout of store.workouts) {
      await tx.workout.upsert({
        where: { id: workout.id },
        create: {
          id: workout.id,
          name: workout.name,
          description: workout.description ?? null,
          source: "sms",
          restTimerEnabled: Boolean(workout.restTimerEnabled),
          restTimerSeconds: workout.restTimerSeconds ?? null,
          restTimerSound: workout.restTimerSound ?? null,
          exportText: workout.exportText ?? null,
          certifiedAt: workout.certifiedAt ? new Date(workout.certifiedAt) : null,
          createdAt: new Date(workout.createdAt),
        },
        update: {
          name: workout.name,
          description: workout.description ?? null,
          source: "sms",
          restTimerEnabled: Boolean(workout.restTimerEnabled),
          restTimerSeconds: workout.restTimerSeconds ?? null,
          restTimerSound: workout.restTimerSound ?? null,
          exportText: workout.exportText ?? null,
          certifiedAt: workout.certifiedAt ? new Date(workout.certifiedAt) : null,
        },
      });

      await tx.workoutExercise.deleteMany({ where: { workoutId: workout.id } });
      const exercises = store.workoutExercises
        .filter((we) => we.workoutId === workout.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (const exercise of exercises) {
        await tx.workoutExercise.create({
          data: {
            id: exercise.id,
            workoutId: exercise.workoutId,
            exerciseId: exercise.exerciseId,
            blockName: exercise.blockName ?? null,
            sortOrder: exercise.sortOrder,
            sets: exercise.sets,
            reps: exercise.reps,
            notes: exercise.notes,
            setScheme: exercise.setScheme,
            weightTier: exercise.weightTier,
          },
        });
      }
    }
  });
}

export async function probeSmsWorkoutsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.workout.count({ where: { source: "sms" } });
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "SMS workouts DB probe failed";
    return { ok: false, message };
  }
}