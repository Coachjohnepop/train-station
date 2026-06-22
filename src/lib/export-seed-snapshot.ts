import "server-only";

import { hydrateDemoExercises, isDemoMode, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed } from "@/lib/demo-seed-store";

export type SeedSnapshot = {
  _meta: {
    exportedAt: string;
    note: string;
    source: string;
  };
  subscriptionTiers?: unknown[];
  exercises: unknown[];
  workouts: unknown[];
  workoutExercises: unknown[];
  programs: unknown[];
  programWeeks: unknown[];
  programDays: unknown[];
  programDayOptions: unknown[];
  equipment?: unknown[];
  userEquipment?: unknown[];
  liveSessions?: unknown[];
  userWeatherLogs?: unknown[];
  eatingApproaches?: unknown[];
  prompts?: unknown[];
  promptResponses?: unknown[];
  userMeasurements?: unknown[];
};

export async function buildDemoSeedSnapshot(): Promise<SeedSnapshot> {
  await hydrateDemoExercises({ preferFresh: true });
  const seed = await getDemoSeed({ preferFresh: true });
  const exercises = loadDemoExercises();

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      note:
        "Full content snapshot exported from admin. Commit as prisma/seed-data.json for permanent deploy snapshot.",
      source: "admin-export",
    },
    subscriptionTiers: (seed.subscriptionTiers as unknown[]) || [],
    exercises,
    workouts: (seed.workouts as unknown[]) || [],
    workoutExercises: (seed.workoutExercises as unknown[]) || [],
    programs: (seed.programs as unknown[]) || [],
    programWeeks: (seed.programWeeks as unknown[]) || [],
    programDays: (seed.programDays as unknown[]) || [],
    programDayOptions: (seed.programDayOptions as unknown[]) || [],
    equipment: (seed.equipment as unknown[]) || [],
    userEquipment: (seed.userEquipment as unknown[]) || [],
    liveSessions: (seed.liveSessions as unknown[]) || [],
    userWeatherLogs: (seed.userWeatherLogs as unknown[]) || [],
    eatingApproaches: (seed.eatingApproaches as unknown[]) || [],
    prompts: (seed.prompts as unknown[]) || [],
    promptResponses: (seed.promptResponses as unknown[]) || [],
    userMeasurements: (seed.userMeasurements as unknown[]) || [],
  };
}

export async function buildSeedSnapshot(): Promise<SeedSnapshot> {
  if (isDemoMode()) {
    return buildDemoSeedSnapshot();
  }

  const { prisma } = await import("@/lib/prisma");
  const [
    subscriptionTiers,
    exercises,
    workouts,
    workoutExercises,
    programs,
    programWeeks,
    programDays,
    programDayOptions,
    equipment,
    userEquipment,
    liveSessions,
    userWeatherLogs,
    eatingApproaches,
    prompts,
    promptResponses,
    userMeasurements,
  ] = await Promise.all([
    prisma.subscriptionTier.findMany(),
    prisma.exercise.findMany(),
    prisma.workout.findMany(),
    prisma.workoutExercise.findMany(),
    prisma.program.findMany(),
    prisma.programWeek.findMany(),
    prisma.programDay.findMany(),
    prisma.programDayOption.findMany(),
    prisma.equipment.findMany(),
    prisma.userEquipment.findMany(),
    prisma.liveSession.findMany(),
    prisma.userWeatherLog.findMany(),
    prisma.eatingApproach.findMany(),
    prisma.prompt.findMany(),
    prisma.promptResponse.findMany(),
    prisma.userMeasurement.findMany(),
  ]);

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      note:
        "Full content snapshot exported from admin. Commit as prisma/seed-data.json for permanent deploy snapshot.",
      source: "admin-export-db",
    },
    subscriptionTiers,
    exercises,
    workouts,
    workoutExercises,
    programs,
    programWeeks,
    programDays,
    programDayOptions,
    equipment,
    userEquipment,
    liveSessions,
    userWeatherLogs,
    eatingApproaches,
    prompts,
    promptResponses,
    userMeasurements,
  };
}