import type { MemberExerciseBlock, MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { resolveExerciseVideoUrl } from "@/lib/exercise-video-hints";

/** Jeremy's typical pre-session warm-up blocks (editable by coach in settings). */
export type WarmupBlockTemplate = {
  id: string;
  name: string;
  exerciseId: string | null;
  setCount: number;
  setScheme: string;
  repPattern: string | null;
  reps: string | null;
  weightTier: string;
  notes: string | null;
};

export const DEFAULT_WARMUP_BLOCKS: WarmupBlockTemplate[] = [
  {
    id: "wu-cardio",
    name: "Warm up well 5 min bike",
    // Low Intensity Cardio Warmup / bike — not Upper body (was wrong ID)
    exerciseId: "ex_8cdc7b709d784cccbbd7ddb3260ff062",
    setCount: 1,
    setScheme: "timed",
    repPattern: null,
    reps: "5 min",
    weightTier: "light",
    notes: "Low to medium intensity — bike, row, or brisk walk",
  },
  {
    id: "wu-upper",
    name: "Upper body warm up",
    exerciseId: "ex_fba6bb97ed534562b2d638c964ffbe9f",
    setCount: 2,
    setScheme: "standard",
    repPattern: null,
    reps: "10",
    weightTier: "light",
    notes: null,
  },
  {
    id: "wu-shoulder",
    name: "Shoulder mobility warm",
    exerciseId: "ex_516ddb6929424c8c82e1c634ae0ba8fd",
    setCount: 2,
    setScheme: "standard",
    repPattern: null,
    reps: "10",
    weightTier: "light",
    notes: "Light weight bands",
  },
  {
    id: "wu-bands",
    name: "Up with bands",
    // Band Rear Delt Extensions — "Up with bands" is often missing from catalog
    exerciseId: "cmpzjajeu000195rzcjo4p43p",
    setCount: 2,
    setScheme: "standard",
    repPattern: null,
    reps: "15",
    weightTier: "light",
    notes: "Band pull-aparts, rear delt extensions, or similar",
  },
];

const WARMUP_NAME_RE =
  /warm[- ]?up|mobility|stretch|foam|band|cardio warm|5 min bike|up with bands/i;

export function isWarmupExerciseName(name: string): boolean {
  return WARMUP_NAME_RE.test(name);
}

export function splitWarmupAndMain<T extends { name: string }>(
  exercises: T[],
): { warmups: T[]; main: T[] } {
  const warmups: T[] = [];
  const main: T[] = [];
  for (const ex of exercises) {
    if (isWarmupExerciseName(ex.name)) warmups.push(ex);
    else main.push(ex);
  }
  return { warmups, main };
}

export function buildWarmupWorkoutView(
  memberName: string,
  blocks: WarmupBlockTemplate[] = DEFAULT_WARMUP_BLOCKS,
): MemberWorkoutView {
  const exercises: MemberExerciseBlock[] = blocks.map((b) => ({
    id: b.id,
    exerciseId: b.exerciseId || b.id,
    name: b.name,
    description: b.notes,
    videoUrl: resolveExerciseVideoUrl({ name: b.name, videoUrl: null }),
    setScheme: b.setScheme,
    repPattern: b.repPattern,
    reps: b.reps,
    setCount: b.setCount,
    weightTier: b.weightTier,
    past: null,
  }));

  return {
    workoutId: "warmup-template",
    workoutName: "Warm-up",
    memberName,
    exercises,
  };
}

/** Map legacy coach-settings values onto valid set approaches. */
function normalizeWarmupSetScheme(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "standard";
  const s = raw.trim().toLowerCase();
  if (s === "reps" || s === "rep") return "standard";
  if (s === "timed_sets" || s === "time") return "timed";
  return raw.trim();
}

export function normalizeWarmupBlocks(raw: unknown): WarmupBlockTemplate[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b }));
  const out: WarmupBlockTemplate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Partial<WarmupBlockTemplate>;
    if (!b.name || typeof b.name !== "string") continue;
    out.push({
      id: typeof b.id === "string" && b.id ? b.id : `wu-${out.length}`,
      name: b.name,
      exerciseId: typeof b.exerciseId === "string" ? b.exerciseId : null,
      setCount: typeof b.setCount === "number" && b.setCount > 0 ? b.setCount : 1,
      setScheme: normalizeWarmupSetScheme(b.setScheme),
      repPattern: b.repPattern ?? null,
      reps: b.reps ?? null,
      weightTier: typeof b.weightTier === "string" ? b.weightTier : "light",
      notes: typeof b.notes === "string" ? b.notes : null,
    });
  }
  return out.length ? out : DEFAULT_WARMUP_BLOCKS.map((x) => ({ ...x }));
}