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

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePublishedAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function stripRow(row: Record<string, unknown>, omit: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const key of omit) delete out[key];
  return out;
}

function normalizeExercise(row: Record<string, unknown>) {
  const data = stripRow(row, ["workoutItems", "performances", "requiredEquipment"]);
  return {
    ...data,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

function normalizeWorkout(row: Record<string, unknown>) {
  const data = stripRow(row, ["exercises", "programDays", "dayOptions", "logs"]);
  return {
    ...data,
    certifiedAt: data.certifiedAt ? toDate(data.certifiedAt) ?? null : null,
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

function normalizeProgram(row: Record<string, unknown>) {
  const data = stripRow(row, ["weeks", "enrollments", "_count"]);
  return {
    ...data,
    published: toBool(data.published, true),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };
}

function normalizeLiveSession(row: Record<string, unknown>) {
  const data = stripRow(row, []);
  return {
    ...data,
    startsAt: toDate(data.startsAt) ?? new Date(),
    createdAt: toDate(data.createdAt) ?? new Date(),
  };
}

function normalizeProgramDay(row: Record<string, unknown>): Record<string, unknown> {
  const { options: _options, publishedAt, ...dayData } = row;
  return {
    ...dayData,
    publishedAt: parsePublishedAt(publishedAt),
  };
}

/** Golden catalog from committed prisma/seed-data.json (no blob). */
export function loadCatalogSnapshotFromSeedFile(
  seed: CatalogSnapshot & Record<string, unknown>,
): { snapshot: CatalogSnapshot; source: string } {
  const workoutExercises = (seed.workoutExercises as Array<Record<string, unknown>>) || [];
  const exerciseById = new Map<string, Record<string, unknown>>();

  for (const row of (seed.exercises as Array<Record<string, unknown>>) || []) {
    if (row?.id) exerciseById.set(String(row.id), row);
  }
  for (const row of workoutExercises) {
    const embedded = row.exercise as Record<string, unknown> | undefined;
    if (embedded?.id) exerciseById.set(String(embedded.id), embedded);
  }

  const exercises = [...exerciseById.values()];
  const exerciseIds = new Set(exercises.map((e) => String(e.id)));
  const workouts = (seed.workouts as Array<Record<string, unknown>>) || [];
  const workoutIds = new Set(workouts.map((w) => String(w.id)));
  const programWeeks = (seed.programWeeks as Array<Record<string, unknown>>) || [];
  const weekIds = new Set(programWeeks.map((w) => String(w.id)));
  const programDays = ((seed.programDays as Array<Record<string, unknown>>) || []).filter(
    (row) =>
      weekIds.has(String(row.weekId)) &&
      (!row.workoutId || workoutIds.has(String(row.workoutId))),
  );
  const dayIds = new Set(programDays.map((d) => String(d.id)));
  const programDayOptions = (
    (seed.programDayOptions as Array<Record<string, unknown>>) || []
  ).filter(
    (row) =>
      dayIds.has(String(row.dayId)) && workoutIds.has(String(row.workoutId)),
  );

  return {
    source: "prisma/seed-data.json",
    snapshot: {
      exercises,
      workouts,
      workoutExercises: workoutExercises.filter(
        (row) =>
          exerciseIds.has(String(row.exerciseId)) && workoutIds.has(String(row.workoutId)),
      ),
      programs: (seed.programs as Array<Record<string, unknown>>) || [],
      programWeeks,
      programDays,
      programDayOptions,
      equipment: (seed.equipment as Array<Record<string, unknown>>) || [],
      userEquipment: (seed.userEquipment as Array<Record<string, unknown>>) || [],
      liveSessions: (seed.liveSessions as Array<Record<string, unknown>>) || [],
      userWeatherLogs: (seed.userWeatherLogs as Array<Record<string, unknown>>) || [],
    },
  };
}

export async function loadCatalogSnapshotFromDemoSources(): Promise<{
  snapshot: CatalogSnapshot;
  source: string;
}> {
  await hydrateDemoExercises({ preferFresh: true });
  const seed = await getDemoSeed({ preferFresh: true });
  const workoutExercises = (seed.workoutExercises as Array<Record<string, unknown>>) || [];
  const exerciseById = new Map<string, Record<string, unknown>>();

  for (const row of (seed.exercises as Array<Record<string, unknown>>) || []) {
    if (row?.id) exerciseById.set(String(row.id), row);
  }
  for (const row of loadDemoExercises()) {
    if (row?.id) exerciseById.set(String(row.id), row);
  }
  for (const row of workoutExercises) {
    const embedded = row.exercise as Record<string, unknown> | undefined;
    if (embedded?.id) exerciseById.set(String(embedded.id), embedded);
  }

  const exercises = [...exerciseById.values()];
  const exerciseIds = new Set(exercises.map((e) => String(e.id)));
  const workouts = (seed.workouts as Array<Record<string, unknown>>) || [];
  const workoutIds = new Set(workouts.map((w) => String(w.id)));
  const programWeeks = (seed.programWeeks as Array<Record<string, unknown>>) || [];
  const weekIds = new Set(programWeeks.map((w) => String(w.id)));
  const programDays = ((seed.programDays as Array<Record<string, unknown>>) || []).filter(
    (row) =>
      weekIds.has(String(row.weekId)) &&
      (!row.workoutId || workoutIds.has(String(row.workoutId))),
  );
  const dayIds = new Set(programDays.map((d) => String(d.id)));
  const programDayOptions = (
    (seed.programDayOptions as Array<Record<string, unknown>>) || []
  ).filter(
    (row) =>
      dayIds.has(String(row.dayId)) && workoutIds.has(String(row.workoutId)),
  );

  return {
    source: "blob-or-local-seed",
    snapshot: {
      exercises,
      workouts,
      workoutExercises: workoutExercises.filter(
        (row) =>
          exerciseIds.has(String(row.exerciseId)) && workoutIds.has(String(row.workoutId)),
      ),
      programs: (seed.programs as Array<Record<string, unknown>>) || [],
      programWeeks,
      programDays,
      programDayOptions,
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
    const data = normalizeExercise(row);
    await prisma.exercise.upsert({
      where: { id: String(row.id) },
      update: data as never,
      create: data as never,
    });
  }
  for (const row of snapshot.workouts || []) {
    const data = normalizeWorkout(row);
    await prisma.workout.upsert({
      where: { id: String(row.id) },
      update: data as never,
      create: data as never,
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
    const data = normalizeProgram(row);
    await prisma.program.upsert({
      where: { id: String(row.id) },
      update: data as never,
      create: data as never,
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
      where: { id: String(row.id) },
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
  // Member rows reference User — import after db:seed, not during coach-catalog go-live.
  for (const row of snapshot.liveSessions || []) {
    const data = normalizeLiveSession(row);
    await prisma.liveSession.upsert({
      where: { id: String(row.id) },
      update: data as never,
      create: data as never,
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
    userEquipment: 0,
    liveSessions: snapshot.liveSessions?.length ?? 0,
    userWeatherLogs: 0,
    source,
  };
}