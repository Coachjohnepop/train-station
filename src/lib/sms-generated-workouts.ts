import path from "path";
import { randomUUID } from "crypto";
import {
  loadExerciseCatalogForMatching,
  loadExercisesByIds,
  resolveExerciseForWorkoutBlock,
  type CatalogExercise,
} from "@/lib/exercise-catalog-load";
import { hydrateDemoExercises, loadDemoExercises, saveDemoExercises } from "@/lib/demo-exercises";
import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";
import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { resolveUserId } from "@/lib/current-user";
import { getPastsForWorkoutExercises } from "@/lib/workout-logs-store";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { hydrateTodaySessions, listTodaySessions } from "@/lib/today-sessions";
import { matchExerciseInCatalog, sanitizeSmsExerciseName } from "@/lib/exercise-match";
import { isCoachCatalogDemo } from "@/lib/catalog-mode";
import { hintVideoUrlForExerciseName, resolveExerciseVideoUrl } from "@/lib/exercise-video-hints";
import { DEFAULT_REST_TIMER_SECONDS, normalizeRestTimerSeconds } from "@/lib/rest-timer";
import { loadSmsWorkoutsFromDb, persistSmsWorkoutStoreToDb } from "@/lib/sms-workouts-db";
import {
  emptySmsWorkoutStore,
  type SmsWorkoutStore,
} from "@/lib/sms-workouts-types";

const WORKOUTS_FILE = path.join(process.cwd(), "prisma", "sms-workouts.dev.json");
const BLOB_PATH = "demo/sms-workouts.json";

export type WorkoutRestTimerSettings = {
  enabled: boolean;
  seconds: number;
};

let memoryStore: SmsWorkoutStore | null = null;

function emptyStore(): SmsWorkoutStore {
  return emptySmsWorkoutStore();
}

function setMemory(store: SmsWorkoutStore) {
  memoryStore = store;
}

export async function hydrateSmsWorkouts(opts?: {
  preferFresh?: boolean;
}): Promise<SmsWorkoutStore> {
  if (!isDemoMode()) {
    const store = await loadSmsWorkoutsFromDb();
    setMemory(store);
    return store;
  }

  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: WORKOUTS_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
    preferFresh: opts?.preferFresh,
  });
}

export function readSmsWorkoutStore(): SmsWorkoutStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<SmsWorkoutStore>(WORKOUTS_FILE) || emptyStore();
  return memoryStore;
}

export async function writeSmsWorkoutStore(store: SmsWorkoutStore) {
  if (!isDemoMode()) {
    await persistSmsWorkoutStoreToDb(store);
    setMemory(store);
    return { blobSaved: true };
  }

  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: WORKOUTS_FILE,
    data: store,
    setMemory,
  });
}

async function patchExerciseVideoIfMissing(exercise: CatalogExercise): Promise<CatalogExercise> {
  if (exercise.videoUrl) return exercise;
  const hint = hintVideoUrlForExerciseName(exercise.name);
  if (!hint) return exercise;

  if (!isCoachCatalogDemo()) {
    return prisma.exercise.update({
      where: { id: exercise.id },
      data: { videoUrl: hint },
      select: { id: true, name: true, description: true, tags: true, videoUrl: true },
    });
  }

  await hydrateDemoExercises();
  const exercises = loadDemoExercises();
  const next = { ...exercise, videoUrl: hint, updatedAt: new Date().toISOString() };
  await saveDemoExercises(exercises.map((e) => (e.id === exercise.id ? next : e)));
  return next;
}

async function ensureExercise(
  rawName: string,
  notes?: string,
): Promise<{ exercise: CatalogExercise; created: boolean }> {
  const catalog = await loadExerciseCatalogForMatching();
  const resolved = await resolveExerciseForWorkoutBlock(rawName, notes, catalog);
  const patched = await patchExerciseVideoIfMissing(resolved.exercise);
  return { exercise: patched, created: resolved.created };
}

async function parsedSmsNamesForWorkout(workoutId: string): Promise<string[]> {
  await hydrateTodaySessions();
  const session = listTodaySessions().find((s) => s.workoutId === workoutId);
  if (!session?.rawSms) return [];
  return parseSmsWorkout(session.rawSms).exercises.map((e) => e.name);
}

/** Re-link SMS workout blocks to library exercises (restores videoUrl via catalog + hints). */
export async function relinkSmsWorkoutExercises(workoutId: string): Promise<{
  workoutId: string;
  relinked: number;
  videos: number;
}> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  let exercises = await loadExerciseCatalogForMatching();
  const items = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const parsedNames = await parsedSmsNamesForWorkout(workoutId);
  let relinked = 0;
  let videos = 0;

  for (const item of items) {
    const current = exercises.find((e) => e.id === item.exerciseId);
    const blockName =
      item.blockName?.trim() ||
      parsedNames[item.sortOrder]?.trim() ||
      current?.name ||
      "Exercise";
    if (!item.blockName) item.blockName = blockName;

    const matched = matchExerciseInCatalog(blockName, exercises);
    if (!matched) continue;

    if (matched.id !== item.exerciseId) {
      item.exerciseId = matched.id;
      relinked++;
    }
    const patched = await patchExerciseVideoIfMissing(matched);
    exercises = await loadExerciseCatalogForMatching();
    if (resolveExerciseVideoUrl(patched)) videos++;
  }

  await writeSmsWorkoutStore(store);
  return { workoutId, relinked, videos };
}

export async function updateWorkoutRestTimer(
  workoutId: string,
  restTimer: WorkoutRestTimerSettings,
): Promise<void> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  if (!workout) return;
  workout.restTimerEnabled = restTimer.enabled;
  workout.restTimerSeconds = restTimer.enabled
    ? normalizeRestTimerSeconds(restTimer.seconds)
    : undefined;
  await writeSmsWorkoutStore(store);
}

export async function buildWorkoutFromParsedSms(
  parsed: ParsedSmsWorkout,
  workoutId?: string,
  restTimer?: WorkoutRestTimerSettings,
) {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  let catalog = await loadExerciseCatalogForMatching();
  const id = workoutId || `sms-w-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  store.workouts = store.workouts.filter((w) => w.id !== id);
  store.workoutExercises = store.workoutExercises.filter((we) => we.workoutId !== id);

  store.workouts.push({
    id,
    name: parsed.title,
    description: "Generated from coach SMS",
    source: "sms",
    createdAt: now,
    restTimerEnabled: restTimer?.enabled ?? false,
    restTimerSeconds: restTimer?.enabled
      ? normalizeRestTimerSeconds(restTimer.seconds)
      : undefined,
  });

  const newExerciseIds: string[] = [];

  for (const [idx, ex] of parsed.exercises.entries()) {
    const resolved = await resolveExerciseForWorkoutBlock(ex.name, ex.notes, catalog);
    catalog = resolved.catalog;
    if (resolved.created) newExerciseIds.push(resolved.exercise.id);
    const exercise = resolved.exercise;

    store.workoutExercises.push({
      id: `sms-we-${randomUUID().slice(0, 8)}`,
      workoutId: id,
      exerciseId: exercise.id,
      blockName: ex.name,
      sortOrder: idx,
      sets: ex.sets,
      reps: ex.reps,
      notes: [ex.notes, ex.section === "warmup" ? "Warm-up block" : null].filter(Boolean).join(" · ") || null,
      setScheme: ex.setScheme || "standard",
      weightTier: "medium",
    });
  }

  const { blobSaved } = await writeSmsWorkoutStore(store);
  if (isDemoMode()) {
    requireBlobPersisted(blobSaved, "Lesson plan draft");
  }
  return { workoutId: id, exerciseCount: parsed.exercises.length, newExerciseIds };
}

export type WorkoutExerciseBlockMeta = {
  id: string;
  name: string;
  setCount: number;
};

export async function getWorkoutExerciseBlocks(workoutId: string): Promise<WorkoutExerciseBlockMeta[]> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const items = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const exById = await loadExercisesByIds(items.map((item) => item.exerciseId));
  return items.map((item) => ({
    id: item.id,
    name:
      sanitizeSmsExerciseName(item.blockName || "") ||
      exById[item.exerciseId]?.name ||
      "Exercise",
    setCount: item.sets ?? 3,
  }));
}

export async function getWorkoutExercisePreview(workoutId: string, limit = 4): Promise<string[]> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const blocks = await getWorkoutExerciseBlocks(workoutId);
  return blocks.slice(0, limit).map((block) => block.name);
}

export async function getSmsGeneratedWorkout(
  workoutId: string,
  memberName = "Member",
  userId?: string,
): Promise<MemberWorkoutView | null> {
  await hydrateSmsWorkouts();
  const store = readSmsWorkoutStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  const items = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const exById = await loadExercisesByIds(items.map((item) => item.exerciseId));

  const blocks = items.map((item) => {
    const ex = exById[item.exerciseId] || { name: "Exercise" };
    const displayName =
      sanitizeSmsExerciseName(item.blockName || "") || ex.name || "Exercise";
    return {
      id: item.id,
      exerciseId: item.exerciseId,
      name: displayName,
      description: item.notes ?? ex.description ?? null,
      videoUrl: resolveExerciseVideoUrl(ex),
      setScheme: item.setScheme || "standard",
      repPattern: null,
      reps: item.reps,
      setCount: item.sets ?? 3,
      weightTier: item.weightTier ?? "medium",
      past: null,
    };
  });

  const uid = userId || (await resolveUserId());
  const pastByBlockId: Record<string, any> = {};
  try {
    Object.assign(pastByBlockId, await getPastsForWorkoutExercises(blocks, uid));
  } catch {
    // non-fatal
  }

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    memberName,
    exercises: blocks.map((b) => ({ ...b, past: pastByBlockId[b.id] ?? null })),
    restTimerEnabled: Boolean(workout.restTimerEnabled),
    restTimerSeconds: workout.restTimerEnabled
      ? normalizeRestTimerSeconds(workout.restTimerSeconds ?? DEFAULT_REST_TIMER_SECONDS)
      : undefined,
  };
}