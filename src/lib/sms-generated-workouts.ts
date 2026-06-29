import path from "path";
import { randomUUID } from "crypto";
import { hydrateDemoExercises, loadDemoExercises, saveDemoExercises, createDemoExerciseId, isDemoMode } from "@/lib/demo-exercises";
import type { ParsedSmsWorkout } from "@/lib/sms-workout-parser";
import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { resolveUserId } from "@/lib/current-user";
import { getDemoPastsForWorkoutExercises } from "@/lib/demo-logs";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

const WORKOUTS_FILE = path.join(process.cwd(), "prisma", "sms-workouts.dev.json");
const BLOB_PATH = "demo/sms-workouts.json";

type SmsWorkoutStore = {
  workouts: Array<{ id: string; name: string; description?: string; source: "sms"; createdAt: string }>;
  workoutExercises: Array<{
    id: string;
    workoutId: string;
    exerciseId: string;
    sortOrder: number;
    sets: number | null;
    reps: string | null;
    notes: string | null;
    setScheme: string | null;
    weightTier: string | null;
  }>;
};

let memoryStore: SmsWorkoutStore | null = null;

function emptyStore(): SmsWorkoutStore {
  return { workouts: [], workoutExercises: [] };
}

function setMemory(store: SmsWorkoutStore) {
  memoryStore = store;
}

export async function hydrateSmsWorkouts(): Promise<SmsWorkoutStore> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: WORKOUTS_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
  });
}

function readStore(): SmsWorkoutStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<SmsWorkoutStore>(WORKOUTS_FILE) || emptyStore();
  return memoryStore;
}

async function writeStore(store: SmsWorkoutStore) {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: WORKOUTS_FILE,
    data: store,
    setMemory,
  });
}

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchExercise(name: string, exercises: any[]): any | null {
  const target = normalizeName(name);
  const exact = exercises.find((e) => normalizeName(e.name) === target);
  if (exact) return exact;

  const keywords = target.split(" ").filter((w) => w.length > 3);
  let best: any = null;
  let bestScore = 0;
  for (const ex of exercises) {
    const en = normalizeName(ex.name);
    let score = 0;
    for (const kw of keywords) {
      if (en.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return bestScore >= Math.min(3, keywords.length) ? best : null;
}

import { NEWLY_ADDED_EXERCISE_TAG } from "@/lib/text-upload-exercises";

async function ensureExercise(name: string, notes?: string): Promise<{ exercise: ReturnType<typeof loadDemoExercises>[number]; created: boolean }> {
  await hydrateDemoExercises();
  const exercises = loadDemoExercises();
  const existing = matchExercise(name, exercises);
  if (existing) return { exercise: existing, created: false };

  const created = {
    id: createDemoExerciseId(),
    name,
    description: notes || `Created from text upload (${new Date().toISOString().slice(0, 10)})`,
    tags: NEWLY_ADDED_EXERCISE_TAG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveDemoExercises([...exercises, created]);
  return { exercise: created, created: true };
}

export async function buildWorkoutFromParsedSms(parsed: ParsedSmsWorkout, workoutId?: string) {
  await hydrateSmsWorkouts();
  const store = readStore();
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
  });

  const newExerciseIds: string[] = [];
  for (const [idx, ex] of parsed.exercises.entries()) {
    const { exercise, created } = await ensureExercise(ex.name, ex.notes);
    if (created) newExerciseIds.push(exercise.id);
    store.workoutExercises.push({
      id: `sms-we-${randomUUID().slice(0, 8)}`,
      workoutId: id,
      exerciseId: exercise.id,
      sortOrder: idx,
      sets: ex.sets,
      reps: ex.reps,
      notes: [ex.notes, ex.section === "warmup" ? "Warm-up block" : null].filter(Boolean).join(" · ") || null,
      setScheme: ex.setScheme || "standard",
      weightTier: "medium",
    });
  }

  await writeStore(store);
  return { workoutId: id, exerciseCount: parsed.exercises.length, newExerciseIds };
}

export type WorkoutExerciseBlockMeta = {
  id: string;
  name: string;
  setCount: number;
};

export async function getWorkoutExerciseBlocks(workoutId: string): Promise<WorkoutExerciseBlockMeta[]> {
  await hydrateSmsWorkouts();
  const store = readStore();
  const exercises = loadDemoExercises();
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  return store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      name: exById[item.exerciseId]?.name || "Exercise",
      setCount: item.sets ?? 3,
    }));
}

export async function getWorkoutExercisePreview(workoutId: string, limit = 4): Promise<string[]> {
  await hydrateSmsWorkouts();
  const store = readStore();
  const exercises = loadDemoExercises();
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const blocks = await getWorkoutExerciseBlocks(workoutId);
  return blocks.slice(0, limit).map((block) => block.name);
}

export async function getSmsGeneratedWorkout(
  workoutId: string,
  memberName = "Member",
  userId?: string,
): Promise<MemberWorkoutView | null> {
  await hydrateSmsWorkouts();
  const store = readStore();
  const workout = store.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  const exercises = loadDemoExercises();
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const items = store.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const blocks = items.map((item) => {
    const ex = exById[item.exerciseId] || { name: "Exercise" };
    return {
      id: item.id,
      exerciseId: item.exerciseId,
      name: ex.name,
      description: item.notes ?? ex.description ?? null,
      videoUrl: ex.videoUrl ?? null,
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
  if (isDemoMode()) {
    Object.assign(pastByBlockId, getDemoPastsForWorkoutExercises(blocks, uid));
  }

  return {
    workoutId: workout.id,
    workoutName: workout.name,
    memberName,
    exercises: blocks.map((b) => ({ ...b, past: pastByBlockId[b.id] ?? null })),
  };
}