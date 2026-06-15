import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { loadDemoExercises, saveDemoExercises, createDemoExerciseId, isDemoMode } from "@/lib/demo-exercises";
import type { ParsedSmsExercise, ParsedSmsWorkout } from "@/lib/sms-workout-parser";
import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { resolveUserId } from "@/lib/current-user";
import { getDemoPastsForWorkoutExercises } from "@/lib/demo-logs";

const WORKOUTS_FILE = path.join(process.cwd(), "prisma", "sms-workouts.dev.json");

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

function readStore(): SmsWorkoutStore {
  if (!fs.existsSync(WORKOUTS_FILE)) {
    return { workouts: [], workoutExercises: [] };
  }
  return JSON.parse(fs.readFileSync(WORKOUTS_FILE, "utf8"));
}

function writeStore(store: SmsWorkoutStore) {
  fs.writeFileSync(WORKOUTS_FILE, JSON.stringify(store, null, 2));
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

function ensureExercise(name: string, notes?: string) {
  const exercises = loadDemoExercises();
  const existing = matchExercise(name, exercises);
  if (existing) return existing;

  const created = {
    id: createDemoExerciseId(),
    name,
    description: notes || `Created from SMS workout (${new Date().toISOString().slice(0, 10)})`,
    tags: "sms-import",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveDemoExercises([...exercises, created]);
  return created;
}

export function buildWorkoutFromParsedSms(parsed: ParsedSmsWorkout, workoutId?: string) {
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

  parsed.exercises.forEach((ex, idx) => {
    const exercise = ensureExercise(ex.name, ex.notes);
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
  });

  writeStore(store);
  return { workoutId: id, exerciseCount: parsed.exercises.length };
}

export async function getSmsGeneratedWorkout(workoutId: string, memberName = "Member"): Promise<MemberWorkoutView | null> {
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

  const uid = await resolveUserId("demo-user");
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