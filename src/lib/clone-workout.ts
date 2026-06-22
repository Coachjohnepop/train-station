import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { mutateDemoSeed } from "@/lib/demo-seed-store";
import { resolveDemoExercise } from "@/lib/demo-workout-items";

export function isDemoMode(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return !url || url.includes("dummy.supabase") || url.includes("dummy");
}

function newDemoWorkoutId(): string {
  return `new-w-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function newDemoWorkoutExerciseId(): string {
  return `demo-we-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export type ClonedWorkout = {
  id: string;
  name: string;
  description: string | null;
  blobSaved?: boolean;
};

export async function cloneWorkout(
  sourceWorkoutId: string,
  name?: string,
): Promise<ClonedWorkout> {
  if (isDemoMode()) {
    await hydrateDemoExercises({ preferFresh: true });
    const exList = loadDemoExercises();

    const created: { workout: ClonedWorkout | null } = { workout: null };

    let blobSaved = false;
    const result = await mutateDemoSeed((data) => {
      const workouts = (data.workouts as any[]) || [];
      const source = workouts.find((w) => w.id === sourceWorkoutId);
      if (!source) {
        throw new Error("WORKOUT_NOT_FOUND");
      }

      const now = new Date().toISOString();
      const workout = {
        id: newDemoWorkoutId(),
        name: name?.trim() || `${source.name} (copy)`,
        description: source.description ?? null,
        createdAt: now,
        updatedAt: now,
      };
      workouts.push(workout);
      data.workouts = workouts;

      const workoutExercises = (data.workoutExercises as any[]) || [];
      const sourceItems = workoutExercises.filter((we) => we.workoutId === sourceWorkoutId);
      for (const we of sourceItems) {
        workoutExercises.push({
          id: newDemoWorkoutExerciseId(),
          workoutId: workout.id,
          exerciseId: we.exerciseId,
          sortOrder: we.sortOrder ?? 0,
          setScheme: we.setScheme ?? null,
          repPattern: we.repPattern ?? null,
          reps: we.reps ?? null,
          sets: we.sets ?? null,
          weightTier: we.weightTier ?? null,
          restSec: we.restSec ?? null,
          notes: we.notes ?? null,
          exercise: resolveDemoExercise(we.exerciseId, exList),
        });
      }
      data.workoutExercises = workoutExercises;
      created.workout = {
        id: workout.id,
        name: workout.name,
        description: workout.description,
      };
    });
    blobSaved = result.blobSaved;

    if (!created.workout) {
      throw new Error("CLONE_FAILED");
    }

    return {
      id: created.workout.id,
      name: created.workout.name,
      description: created.workout.description,
      blobSaved,
    };
  }

  const source = await prisma.workout.findUnique({
    where: { id: sourceWorkoutId },
    include: {
      exercises: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!source) {
    throw new Error("WORKOUT_NOT_FOUND");
  }

  const workout = await prisma.workout.create({
    data: {
      name: name?.trim() || `${source.name} (copy)`,
      description: source.description,
      exercises: {
        create: source.exercises.map((item) => ({
          exerciseId: item.exerciseId,
          sortOrder: item.sortOrder,
          setScheme: item.setScheme,
          repPattern: item.repPattern,
          reps: item.reps,
          sets: item.sets,
          weightTier: item.weightTier,
          restSec: item.restSec,
          notes: item.notes,
        })),
      },
    },
  });

  return {
    id: workout.id,
    name: workout.name,
    description: workout.description,
    blobSaved: true,
  };
}