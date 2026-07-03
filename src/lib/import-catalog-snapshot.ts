import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { hydrateDemoExercises, loadDemoExercises } from "@/lib/demo-exercises";
import { getDemoSeed } from "@/lib/demo-seed-store";

export type CatalogSnapshot = {
  exercises?: Array<Record<string, unknown>>;
  workouts?: Array<Record<string, unknown>>;
  workoutExercises?: Array<Record<string, unknown>>;
  programs?: Array<Record<string, unknown>>;
  programWeeks?: Array<Record<string, unknown>>;
  programDays?: Array<Record<string, unknown>>;
  programDayOptions?: Array<Record<string, unknown>>;
  equipment?: Array<Record<string, unknown>>;
  userEquipment?: Array<Record<string, unknown>>;
  liveSessions?: Array<Record<string, unknown>>;
  userWeatherLogs?: Array<Record<string, unknown>>;
};

export type CatalogImportResult = {
  exercises: number;
  workouts: number;
  workoutExercises: number;
  programs: number;
  programWeeks: number;
  programDays: number;
  programDayOptions: number;
  equipment: number;
  userEquipment: number;
  liveSessions: number;
  userWeatherLogs: number;
  source: string;
};

function parsePublishedAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeProgramDay(row: Record<string, unknown>): Record<string, unknown> {
  const { options: _options, publishedAt, ...dayData } = row;
  return {
    ...dayData,
    publishedAt: parsePublishedAt(publishedAt),
  };
}

export async function loadCatalogSnapshotFromDemoSources(): Promise<{
  snapshot: CatalogSnapshot;
  source: string;
}> {
  await hydrateDemoExercises({ preferFresh: true });
  const seed = await getDemoSeed({ preferFresh: true });
  const exercises = loadDemoExercises();

  return {
    source: "blob-or-local-seed",
    snapshot: {
      exercises,
      workouts: (seed.workouts as Array<Record<string, unknown>>) || [],
      workoutExercises: (seed.workoutExercises as Array<Record<string, unknown>>) || [],
      programs: (seed.programs as Array<Record<string, unknown>>) || [],
      programWeeks: (seed.programWeeks as Array<Record<string, unknown>>) || [],
      programDays: (seed.programDays as Array<Record<string, unknown>>) || [],
      programDayOptions: (seed.programDayOptions as Array<Record<string, unknown>>) || [],
      equipment: (seed.equipment as Array<Record<string, unknown>>) || [],
      userEquipment: (seed.userEquipment as Array<Record<string, unknown>>) || [],
      liveSessions: (seed.liveSessions as Array<Record<string, unknown>>) || [],
      userWeatherLogs: (seed.userWeatherLogs as Array<Record<string, unknown>>) || [],
    },
  };
}

export async function importCatalogSnapshot(
  prisma: PrismaClient,
  snapshot: CatalogSnapshot,
  source = "import",
): Promise<CatalogImportResult> {
  for (const row of snapshot.exercises || []) {
    await prisma.exercise.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.workouts || []) {
    await prisma.workout.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.workoutExercises || []) {
    const { exercise: _exercise, ...item } = row;
    await prisma.workoutExercise.upsert({
      where: { id: String(item.id) },
      update: item as never,
      create: item as never,
    });
  }
  for (const row of snapshot.programs || []) {
    await prisma.program.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.programWeeks || []) {
    await prisma.programWeek.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.programDays || []) {
    const dayData = normalizeProgramDay(row);
    await prisma.programDay.upsert({
      where: { id: String(dayData.id) },
      update: dayData as never,
      create: dayData as never,
    });
  }
  for (const row of snapshot.programDayOptions || []) {
    await prisma.programDayOption.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.equipment || []) {
    await prisma.equipment.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.userEquipment || []) {
    await prisma.userEquipment.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.liveSessions || []) {
    await prisma.liveSession.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }
  for (const row of snapshot.userWeatherLogs || []) {
    await prisma.userWeatherLog.upsert({
      where: { id: String(row.id) },
      update: row as never,
      create: row as never,
    });
  }

  return {
    exercises: snapshot.exercises?.length ?? 0,
    workouts: snapshot.workouts?.length ?? 0,
    workoutExercises: snapshot.workoutExercises?.length ?? 0,
    programs: snapshot.programs?.length ?? 0,
    programWeeks: snapshot.programWeeks?.length ?? 0,
    programDays: snapshot.programDays?.length ?? 0,
    programDayOptions: snapshot.programDayOptions?.length ?? 0,
    equipment: snapshot.equipment?.length ?? 0,
    userEquipment: snapshot.userEquipment?.length ?? 0,
    liveSessions: snapshot.liveSessions?.length ?? 0,
    userWeatherLogs: snapshot.userWeatherLogs?.length ?? 0,
    source,
  };
}