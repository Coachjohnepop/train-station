import type { MemberExerciseBlock, MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { resolveExerciseVideoUrl } from "@/lib/exercise-video-hints";

/** Canonical warm-up workout id — real Workout row edited in admin. */
export const STANDARD_WARMUP_WORKOUT_ID = "warmup-standard";

export function isStandardWarmupWorkoutId(id: string): boolean {
  return id === STANDARD_WARMUP_WORKOUT_ID;
}

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
    id: "wu-bike",
    name: "Bike, row, or brisk walk",
    exerciseId: "ex_8cdc7b709d784cccbbd7ddb3260ff062",
    setCount: 1,
    setScheme: "timed",
    repPattern: null,
    reps: "5 min",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-wall-taps",
    name: "Wall taps",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "20",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-band-pull",
    name: "Band pull-aparts",
    exerciseId: "cmpzjajeu000195rzcjo4p43p",
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "15",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-light-curls",
    name: "Lightweight bicep curls",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "15",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-light-press",
    name: "Light shoulder press",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "15",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-shrugs",
    name: "Shrugs",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "15",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-bosu",
    name: "Bosu ball squats",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "10",
    weightTier: "light",
    notes: "Warm-up block",
  },
  {
    id: "wu-jump-squats",
    name: "Jump squats",
    exerciseId: null,
    setCount: 1,
    setScheme: "standard",
    repPattern: null,
    reps: "10",
    weightTier: "light",
    notes: "Warm-up block",
  },
];

const WARMUP_NAME_RE =
  /warm[- ]?up|mobility|stretch|foam|band|cardio warm|5 min bike|up with bands/i;

/** Coach standard warm-up lines (not “band lat pulldown” or a cooldown stretch). */
const STANDARD_WARMUP_LINE_RE =
  /warm[- ]?up|warm up well|general warm up|shoulder mobility warm|up with bands|low intensity cardio warmup/i;

const REST_OR_OFF_RE = /rest\s*day|rest and|day\s*off|^off$|active recovery|meal prep/i;

export function isWarmupExerciseName(name: string): boolean {
  return WARMUP_NAME_RE.test(name);
}

export function isStandardWarmupLineName(name: string): boolean {
  return STANDARD_WARMUP_LINE_RE.test(String(name || ""));
}

export function workoutHasStandardWarmup(exerciseNames: string[]): boolean {
  return exerciseNames.some((n) => isStandardWarmupLineName(n));
}

/** Rest / day-off — no warm-up. Fasted cardio and run finishers are training days. */
export function isRestOrDayOffContent(input: {
  workoutName?: string | null;
  optionLabel?: string | null;
  exerciseNames?: string[];
}): boolean {
  const name = String(input.workoutName || "").trim();
  const label = String(input.optionLabel || "").trim();
  const names = input.exerciseNames || [];
  if (/^day\s*off$/i.test(label)) return true;
  if (REST_OR_OFF_RE.test(name) || REST_OR_OFF_RE.test(label)) return true;
  if (names.some((n) => REST_OR_OFF_RE.test(n))) return true;
  return false;
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