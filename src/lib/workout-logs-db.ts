import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveStorageUserId } from "@/lib/enrollment-db";
import { computeStrengthScoreFromPerfs } from "@/lib/demo-logs";

export type WorkoutExercisePast = {
  setScheme: string;
  repPattern: string | null;
  reps: string | null;
  sets: number | null;
  setsCompleted: number | null;
  weightTier: string;
  startingWeightLbs: number | null;
  performedAt: string;
};

export async function getLoggedWorkoutIdsDb(userId: string): Promise<Set<string>> {
  const storageUserId = await resolveStorageUserId(userId);
  const logs = await prisma.workoutLog.findMany({
    where: { userId: storageUserId },
    select: { workoutId: true },
  });
  const ids = new Set<string>();
  for (const log of logs) {
    if (log.workoutId) ids.add(log.workoutId);
  }
  return ids;
}

export async function getWorkoutLogCountDb(userId: string): Promise<number> {
  const storageUserId = await resolveStorageUserId(userId);
  return prisma.workoutLog.count({ where: { userId: storageUserId } });
}

export async function getPerformanceCountDb(userId: string): Promise<number> {
  const storageUserId = await resolveStorageUserId(userId);
  return prisma.exercisePerformance.count({ where: { userId: storageUserId } });
}

export async function getLatestPerformanceForExerciseDb(
  userId: string,
  exerciseId: string,
) {
  const storageUserId = await resolveStorageUserId(userId);
  return prisma.exercisePerformance.findFirst({
    where: { userId: storageUserId, exerciseId },
    orderBy: { performedAt: "desc" },
  });
}

export async function getPastsForWorkoutExercisesDb(
  exerciseBlocks: Array<{ id: string; exerciseId: string }>,
  userId: string,
): Promise<Record<string, WorkoutExercisePast>> {
  const storageUserId = await resolveStorageUserId(userId);
  const pasts: Record<string, WorkoutExercisePast> = {};

  for (const block of exerciseBlocks) {
    const latest = await prisma.exercisePerformance.findFirst({
      where: { userId: storageUserId, exerciseId: block.exerciseId },
      orderBy: { performedAt: "desc" },
    });
    if (latest) {
      pasts[block.id] = {
        setScheme: latest.setScheme,
        repPattern: null,
        reps: null,
        sets: null,
        setsCompleted: latest.setsCompleted ?? null,
        weightTier: latest.weightTier,
        startingWeightLbs: latest.startingWeightLbs,
        performedAt: latest.performedAt.toISOString(),
      };
    }
  }

  return pasts;
}

export async function getStrengthScoreDb(userId: string): Promise<number> {
  const storageUserId = await resolveStorageUserId(userId);
  const perfs = await prisma.exercisePerformance.findMany({
    where: { userId: storageUserId },
    include: { exercise: { select: { name: true } } },
  });
  return computeStrengthScoreFromPerfs(
    perfs.map((p) => ({
      exercise: { name: p.exercise?.name },
      startingWeightLbs: p.startingWeightLbs,
      repsCompleted: p.repsCompleted,
      setsCompleted: p.setsCompleted,
    })),
  );
}