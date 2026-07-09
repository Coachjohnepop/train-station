import "server-only";

import { loadExerciseCatalogForMatching, loadExercisesByIds } from "@/lib/exercise-catalog-load";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import {
  hydrateSmsWorkouts,
  readSmsWorkoutStore,
  writeSmsWorkoutStore,
} from "@/lib/sms-generated-workouts";
import { randomUUID } from "crypto";

async function persistSmsWorkoutStore(
  store: Awaited<ReturnType<typeof readSmsWorkoutStore>>,
  action: string,
) {
  const { blobSaved } = await writeSmsWorkoutStore(store);
  requireBlobPersisted(blobSaved, action);
}

export function isSmsWorkoutId(id: string): boolean {
  return id.startsWith("sms-w-");
}

type BuilderExercise = {
  id: string;
  name: string;
  videoUrl: string | null;
};

function toBuilderExercise(ex: {
  id: string;
  name: string;
  videoUrl?: string | null;
}): BuilderExercise {
  return { id: ex.id, name: ex.name, videoUrl: ex.videoUrl ?? null };
}

export type BuilderWorkoutItem = {
  id: string;
  sortOrder: number;
  setScheme: string | null;
  repPattern: string | null;
  reps: string | null;
  sets: number | null;
  weightTier: string | null;
  notes: string | null;
  exercise: BuilderExercise;
};

export type BuilderWorkout = {
  id: string;
  name: string;
  description: string | null;
  exportText: string | null;
  certifiedAt: string | null;
  exercises: BuilderWorkoutItem[];
};

function itemToBuilder(
  item: {
    id: string;
    sortOrder: number;
    sets: number | null;
    reps: string | null;
    notes: string | null;
    setScheme: string | null;
    weightTier: string | null;
    exerciseId: string;
  },
  exercise: BuilderExercise,
): BuilderWorkoutItem {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    setScheme: item.setScheme || "standard",
    repPattern: null,
    reps: item.reps,
    sets: item.sets,
    weightTier: item.weightTier || "medium",
    notes: item.notes,
    exercise: {
      id: exercise.id,
      name: exercise.name,
      videoUrl: exercise.videoUrl ?? null,
    },
  };
}

async function loadSmsWorkoutForBuilder(
  workoutId: string,
  opts?: { preferFresh?: boolean },
): Promise<BuilderWorkout | null> {
  await hydrateSmsWorkouts(opts);
  const store = readSmsWorkoutStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  const items = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const exById = await loadExercisesByIds(items.map((i) => i.exerciseId));

  return {
    id: workout.id,
    name: workout.name,
    description: workout.description ?? "Generated from coach SMS",
    exportText: workout.exportText ?? null,
    certifiedAt: workout.certifiedAt ?? null,
    exercises: items.map((item) =>
      itemToBuilder(
        item,
        toBuilderExercise(
          exById[item.exerciseId] || { id: item.exerciseId, name: "Exercise", videoUrl: null },
        ),
      ),
    ),
  };
}

export async function getSmsWorkoutForBuilder(workoutId: string): Promise<BuilderWorkout | null> {
  return loadSmsWorkoutForBuilder(workoutId);
}

async function verifySmsWorkoutPersisted(
  workoutId: string,
  check: (workout: BuilderWorkout) => boolean,
  action: string,
): Promise<BuilderWorkout> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const workout = await loadSmsWorkoutForBuilder(workoutId, { preferFresh: attempt > 0 });
    if (workout && check(workout)) return workout;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  throw new Error(`${action} could not be verified — retry in a moment.`);
}

export async function patchSmsWorkout(
  workoutId: string,
  patch: {
    name?: string;
    description?: string | null;
    exportText?: string | null;
    certifiedAt?: string | null;
    clearCertification?: boolean;
  },
): Promise<BuilderWorkout | null> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  if (patch.name !== undefined) workout.name = patch.name.trim();
  if (patch.description !== undefined) {
    workout.description = patch.description ?? undefined;
  }
  if (patch.clearCertification) {
    workout.exportText = undefined;
    workout.certifiedAt = undefined;
  } else {
    if (patch.exportText !== undefined) workout.exportText = patch.exportText;
    if (patch.certifiedAt !== undefined) workout.certifiedAt = patch.certifiedAt;
  }

  const expectedName = patch.name !== undefined ? patch.name.trim() : undefined;
  await persistSmsWorkoutStore(store, "Workout update");
  return verifySmsWorkoutPersisted(
    workoutId,
    (w) => expectedName === undefined || w.name === expectedName,
    "Workout update",
  );
}

export async function addSmsWorkoutExercise(
  workoutId: string,
  data: {
    exerciseId: string;
    setScheme: string;
    repPattern?: string | null;
    reps?: string | null;
    sets?: number | null;
    weightTier: string;
    restSec?: number | null;
    notes?: string | null;
  },
): Promise<BuilderWorkoutItem | null> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  if (!store.workouts.some((w) => w.id === workoutId)) return null;

  const catalog = await loadExerciseCatalogForMatching();
  const exercise = catalog.find((e) => e.id === data.exerciseId);
  if (!exercise) return null;

  const existing = store.workoutExercises.filter((we) => we.workoutId === workoutId);
  const sortOrder =
    existing.length > 0 ? Math.max(...existing.map((we) => we.sortOrder)) + 1 : 0;

  const item = {
    id: `sms-we-${randomUUID().slice(0, 8)}`,
    workoutId,
    exerciseId: data.exerciseId,
    blockName: exercise.name,
    sortOrder,
    sets: data.sets ?? 3,
    reps: data.reps ?? "10",
    notes: data.notes ?? null,
    setScheme: data.setScheme,
    weightTier: data.weightTier,
  };
  store.workoutExercises.push(item);
  await persistSmsWorkoutStore(store, "Exercise add");

  const verified = await verifySmsWorkoutPersisted(
    workoutId,
    (w) => w.exercises.some((row) => row.id === item.id),
    "Exercise add",
  );
  const row = verified.exercises.find((row) => row.id === item.id);
  return row ?? itemToBuilder(item, toBuilderExercise(exercise));
}

export async function patchSmsWorkoutExercise(
  workoutId: string,
  itemId: string,
  data: {
    exerciseId?: string;
    setScheme?: string;
    repPattern?: string | null;
    reps?: string | null;
    sets?: number | null;
    weightTier?: string;
    notes?: string | null;
    sortOrder?: number;
  },
): Promise<BuilderWorkoutItem | null> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const idx = store.workoutExercises.findIndex((we) => we.id === itemId && we.workoutId === workoutId);
  if (idx < 0) return null;

  const item = { ...store.workoutExercises[idx] };
  if (data.exerciseId !== undefined) item.exerciseId = data.exerciseId;
  if (data.setScheme !== undefined) item.setScheme = data.setScheme;
  if (data.reps !== undefined) item.reps = data.reps;
  if (data.sets !== undefined) item.sets = data.sets;
  if (data.weightTier !== undefined) item.weightTier = data.weightTier;
  if (data.notes !== undefined) item.notes = data.notes;
  if (data.sortOrder !== undefined) item.sortOrder = data.sortOrder;

  store.workoutExercises[idx] = item;
  await persistSmsWorkoutStore(store, "Exercise update");

  const verified = await verifySmsWorkoutPersisted(
    workoutId,
    (w) => {
      const row = w.exercises.find((row) => row.id === itemId);
      if (!row) return false;
      if (data.reps !== undefined && row.reps !== data.reps) return false;
      if (data.sets !== undefined && row.sets !== data.sets) return false;
      if (data.notes !== undefined && row.notes !== data.notes) return false;
      return true;
    },
    "Exercise update",
  );
  return verified.exercises.find((row) => row.id === itemId) ?? null;
}

export async function deleteSmsWorkoutExercise(
  workoutId: string,
  itemId: string,
): Promise<boolean> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const before = store.workoutExercises.length;
  store.workoutExercises = store.workoutExercises.filter(
    (we) => !(we.id === itemId && we.workoutId === workoutId),
  );
  if (store.workoutExercises.length === before) return false;

  const remaining = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  remaining.forEach((we, index) => {
    we.sortOrder = index;
  });

  await persistSmsWorkoutStore(store, "Exercise remove");
  await verifySmsWorkoutPersisted(
    workoutId,
    (w) => !w.exercises.some((row) => row.id === itemId),
    "Exercise remove",
  );
  return true;
}