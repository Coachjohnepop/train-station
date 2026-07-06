import "server-only";

import { prisma } from "@/lib/prisma";
import {
  workoutContentTitle,
  workoutContentTitleKey,
} from "@/lib/workout-content-name";

export async function findWorkoutByContentTitle(name: string) {
  const key = workoutContentTitleKey(name);
  const workouts = await prisma.workout.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return workouts.find((w) => workoutContentTitleKey(w.name) === key) ?? null;
}

export function canonicalWorkoutContentName(name: string): string {
  return workoutContentTitle(name);
}