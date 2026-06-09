import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isDemoMode } from "./demo-enrollments";

const DEV_FILE = path.join(process.cwd(), "prisma", "logs.dev.json");
const SEED_FILE = path.join(process.cwd(), "prisma", "seed-data.json");

export type DemoWorkoutLog = {
  id: string;
  userId: string;
  workoutId: string;
  performedAt: string;
  completed: boolean;
  progress: number;
};

export type DemoExercisePerformance = {
  id: string;
  userId: string;
  exerciseId: string;
  workoutExerciseId: string | null;
  setScheme: string;
  weightTier: string;
  startingWeightLbs: number | null;
  performedAt: string;
  // extra for past display (not in prisma model, only for demo)
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  repsCompleted?: number | null;
  setsCompleted?: number | null;
};

type DemoLogsStore = {
  workoutLogs: DemoWorkoutLog[];
  performances: DemoExercisePerformance[];
};

let cache: DemoLogsStore | null = null;

function loadSeedIds() {
  try {
    const raw = fs.readFileSync(SEED_FILE, "utf8");
    const s = JSON.parse(raw);
    return {
      userId: "demo-user", // matches dashboard mock
      exercises: (s.exercises || []).map((e: any) => e.id),
    };
  } catch {
    return { userId: "demo-user", exercises: [] };
  }
}

function loadStore(): DemoLogsStore {
  if (cache) return cache;
  if (fs.existsSync(DEV_FILE)) {
    try {
      const raw = fs.readFileSync(DEV_FILE, "utf8");
      cache = JSON.parse(raw);
    } catch {
      cache = { workoutLogs: [], performances: [] };
    }
  } else {
    cache = { workoutLogs: [], performances: [] };
    try {
      fs.writeFileSync(DEV_FILE, JSON.stringify(cache, null, 2));
    } catch {}
  }
  return cache!;
}

function saveStore(store: DemoLogsStore) {
  cache = { workoutLogs: [...store.workoutLogs], performances: [...store.performances] };
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("Failed to persist demo logs", e);
  }
}

export function createDemoWorkoutLog(input: {
  workoutId: string;
  userId?: string;
  performedAt?: Date;
  completed?: boolean;
  progress?: number;
}): DemoWorkoutLog {
  const store = loadStore();
  const now = input.performedAt || new Date();
  const userId = input.userId || loadSeedIds().userId;
  const log: DemoWorkoutLog = {
    id: "log_" + randomUUID().replace(/-/g, ""),
    userId,
    workoutId: input.workoutId,
    performedAt: now.toISOString(),
    completed: input.completed ?? ((input.progress ?? 100) === 100),
    progress: input.progress ?? 100,
  };
  store.workoutLogs.push(log);
  saveStore(store);
  return log;
}

export function createDemoExercisePerformance(input: {
  exerciseId: string;
  userId?: string;
  workoutExerciseId?: string | null;
  setScheme: string;
  weightTier: string;
  startingWeightLbs?: number | null;
  performedAt?: Date;
  repPattern?: string | null;
  reps?: string | null;
  sets?: number | null;
  repsCompleted?: number | null;
  setsCompleted?: number | null;
}): DemoExercisePerformance {
  const store = loadStore();
  const now = input.performedAt || new Date();
  const userId = input.userId || loadSeedIds().userId;
  const perf: DemoExercisePerformance = {
    id: "perf_" + randomUUID().replace(/-/g, ""),
    userId,
    exerciseId: input.exerciseId,
    workoutExerciseId: input.workoutExerciseId ?? null,
    setScheme: input.setScheme,
    weightTier: input.weightTier,
    startingWeightLbs: input.startingWeightLbs ?? null,
    performedAt: now.toISOString(),
    repPattern: input.repPattern ?? null,
    reps: input.reps ?? null,
    sets: input.sets ?? null,
    repsCompleted: input.repsCompleted ?? null,
    setsCompleted: input.setsCompleted ?? null,
  };
  store.performances.push(perf);
  saveStore(store);
  return perf;
}

export function getDemoLatestPerformanceForExercise(userId: string, exerciseId: string): DemoExercisePerformance | null {
  const store = loadStore();
  const matches = store.performances
    .filter((p) => p.userId === userId && p.exerciseId === exerciseId)
    .sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));
  return matches[0] || null;
}

/** For a given workout's exercise blocks (with their exerciseId), return a map of exerciseId -> past shape or null */
export function getDemoPastsForWorkoutExercises(exerciseBlocks: Array<{ id: string; exerciseId: string }>): Record<string, any> {
  const userId = loadSeedIds().userId;
  const pasts: Record<string, any> = {};
  for (const b of exerciseBlocks) {
    const p = getDemoLatestPerformanceForExercise(userId, b.exerciseId);
    if (p) {
      pasts[b.id] = {
        setScheme: p.setScheme,
        repPattern: p.repPattern ?? null,
        reps: p.reps ?? null,
        sets: p.sets ?? null,  // prescription sets (for silhouette summary)
        setsCompleted: p.setsCompleted ?? null,  // actual completed for review set grid
        weightTier: p.weightTier,
        startingWeightLbs: p.startingWeightLbs,
        performedAt: p.performedAt,
      };
    }
  }
  return pasts;
}

export function getDemoWorkoutLogCount(userId?: string): number {
  const store = loadStore();
  const uid = userId || loadSeedIds().userId;
  return store.workoutLogs.filter((l) => l.userId === uid).length;
}

export function getDemoPerformanceCount(userId?: string): number {
  const store = loadStore();
  const uid = userId || loadSeedIds().userId;
  return store.performances.filter((p) => p.userId === uid).length;
}

export function isDemoModeForLogs() {
  return isDemoMode();
}

function loadSeedExercises(): any[] {
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    return seed.exercises || [];
  } catch {
    return [];
  }
}

function estimate6RM(weight: number, reps: number): number {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
  // Epley 1RM estimator, then ~85% for 6RM
  const oneRM = weight * (1 + reps / 30);
  return Math.round(oneRM * 0.85);
}

const KEY_LIFT_NAMES = [
  "Back Squat",
  "Bench Press",
  "Dumbell Bench Press",
  "Sitting Military Press",
  "Standing Dumbbell Shoulder Press",
  "Standing Dumbbell Shoulder Press (light)",
  "Standing Straight Bar Cable Tricep Extensions",
  "Dumbbell Tricep Extensions",
  "Standing Angle Bar Cable Tricep",
  "Seated Back Row Machine or",
  "Seated Cable Close Grip Row Bar",
  "Pull-Up",
];

const BENCH_EQUIV_FACTOR: Record<string, number> = {
  "Back Squat": 0.65,                    // squat 6RM * 0.65 ~ bench6 equiv
  "Bench Press": 1.0,
  "Dumbell Bench Press": 1.1,            // per-hand db, total weight roughly
  "Sitting Military Press": 1.55,
  "Standing Dumbbell Shoulder Press": 1.6,
  "Standing Dumbbell Shoulder Press (light)": 1.6,
  "Standing Straight Bar Cable Tricep Extensions": 2.4, // triceps smaller numbers
  "Dumbbell Tricep Extensions": 2.5,
  "Standing Angle Bar Cable Tricep": 2.4,
  "Seated Back Row Machine or": 1.15,
  "Seated Cable Close Grip Row Bar": 1.1,
  "Pull-Up": 1.0,                        // bodyweight proxy, rough
};

/**
 * Compute total strength / power score from demo performances.
 * For each key lift, finds best (weight, reps) -> est 6RM, converts to bench-6RM equivalent
 * using lift-specific factors, then averages the available estimates.
 * No upper cap; grows with better/higher volume lifts.
 * Vaguely represents "what bench 6RM your key lifts suggest".
 */
export function getDemoStrengthScore(): number {
  const store = loadStore();
  const exList = loadSeedExercises();
  const idToName: Record<string, string> = Object.fromEntries(
    exList.map((e: any) => [e.id, e.name])
  );
  const userId = loadSeedIds().userId;

  // group perfs by exercise name
  const byLift: Record<string, Array<{w: number, r: number}>> = {};
  for (const p of store.performances) {
    if (p.userId !== userId) continue;
    const name = idToName[p.exerciseId];
    if (!name || !KEY_LIFT_NAMES.includes(name)) continue;
    const w = p.startingWeightLbs ?? 0;
    const r = (p as any).repsCompleted ?? (p.sets ? p.sets * 5 : 0);
    if (w <= 0 || r <= 0) continue;
    if (!byLift[name]) byLift[name] = [];
    byLift[name].push({w, r});
  }

  const equivs: number[] = [];
  for (const [name, entries] of Object.entries(byLift)) {
    // for each weight, find max r at that w? but for simplicity, take the single best est6 per lift
    let best6 = 0;
    for (const {w, r} of entries) {
      const est = estimate6RM(w, r);
      if (est > best6) best6 = est;
    }
    const factor = BENCH_EQUIV_FACTOR[name] ?? 1.0;
    const benchEquiv = Math.round(best6 * factor);
    if (benchEquiv > 0) equivs.push(benchEquiv);
  }

  if (equivs.length === 0) return 0;
  // average of the bench-equivalents from the key lifts you have data for
  const score = Math.round(equivs.reduce((a, b) => a + b, 0) / equivs.length);
  return score;
}

export function computeStrengthScoreFromPerfs(perfs: Array<{exercise?: {name?: string}, startingWeightLbs?: number | null, repsCompleted?: number | null, setsCompleted?: number | null }>): number {
  const byLift: Record<string, Array<{w: number, r: number}>> = {};
  for (const p of perfs) {
    const name = p.exercise?.name;
    if (!name || !KEY_LIFT_NAMES.includes(name)) continue;
    const w = p.startingWeightLbs ?? 0;
    const r = p.repsCompleted ?? (p.setsCompleted ? p.setsCompleted * 5 : 0);
    if (w <= 0 || r <= 0) continue;
    if (!byLift[name]) byLift[name] = [];
    byLift[name].push({w, r});
  }

  const equivs: number[] = [];
  for (const [name, entries] of Object.entries(byLift)) {
    let best6 = 0;
    for (const {w, r} of entries) {
      const est = estimate6RM(w, r);
      if (est > best6) best6 = est;
    }
    const factor = BENCH_EQUIV_FACTOR[name] ?? 1.0;
    const benchEquiv = Math.round(best6 * factor);
    if (benchEquiv > 0) equivs.push(benchEquiv);
  }

  if (equivs.length === 0) return 0;
  const score = Math.round(equivs.reduce((a, b) => a + b, 0) / equivs.length);
  return score;
}