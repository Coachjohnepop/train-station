import { isTimedApproach } from "@/lib/workout-schemes";

const CALENDAR_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type LoggableWorkoutExercise = {
  id: string;
  exerciseId: string;
  name?: string;
  setScheme: string;
  repPattern?: string | null;
  reps?: string | null;
  setCount: number;
  weightTier: string;
  past?: { startingWeightLbs?: number | null } | null;
};

export type WorkoutLogExercisePayload = {
  workoutExerciseId: string;
  exerciseId: string;
  setScheme: string;
  repPattern: string | null;
  reps: string | null;
  sets: number;
  weightTier: string;
  startingWeightLbs: number | null;
  repsCompleted: number;
  setsCompleted: number;
};

/** YYYY-MM-DD only — enrollment keys like M1D1 / W1D1 are not session dates. */
export function normalizeLogSessionDate(sessionDate?: string | null): string | undefined {
  const raw = sessionDate?.trim();
  return raw && CALENDAR_ISO.test(raw) ? raw : undefined;
}

/** API: keep a valid calendar day, otherwise fall back to the business today. */
export function resolveLogSessionDate(
  raw: string | undefined | null,
  todayIso: string,
): string {
  return normalizeLogSessionDate(raw) ?? todayIso;
}

export function parseLogWeightLbs(
  typed: string | undefined,
  fallback: number | null | undefined,
): number | null {
  const parsed = typed ? parseFloat(typed) : fallback ?? null;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function prescribedSetCount(exercise: Pick<LoggableWorkoutExercise, "setScheme" | "setCount">): number {
  if (isTimedApproach(exercise.setScheme) || /timed?/.test(exercise.setScheme || "")) {
    return 1;
  }
  const sets = Number.isFinite(exercise.setCount) ? Math.floor(exercise.setCount) : 0;
  return Math.max(1, sets);
}

export function repsForLoggedSets(
  exercise: Pick<LoggableWorkoutExercise, "setScheme" | "reps">,
  setsCompleted: number,
): number {
  if (setsCompleted <= 0) return 0;
  if (isTimedApproach(exercise.setScheme) || /timed?/.test(exercise.setScheme || "")) {
    return 12;
  }
  if (exercise.reps) {
    const repNum = parseInt(exercise.reps, 10);
    if (Number.isFinite(repNum) && repNum > 0) return setsCompleted * repNum;
  }
  return setsCompleted * 5;
}

export function countableLogExercises<T extends { id: string }>(
  exercises: T[],
  freeLockedIds?: Iterable<string> | null,
): T[] {
  const locked = freeLockedIds ? new Set(freeLockedIds) : null;
  if (!locked || locked.size === 0) return exercises;
  return exercises.filter((exercise) => !locked.has(exercise.id));
}

export function unfinishedLogExercises<T extends { id: string }>(
  exercises: T[],
  finishedIds: Iterable<string>,
  completedSets: Record<string, { size: number } | number[] | undefined>,
  freeLockedIds?: Iterable<string> | null,
): T[] {
  const finished = new Set(finishedIds);
  return countableLogExercises(exercises, freeLockedIds).filter((exercise) => {
    if (finished.has(exercise.id)) return false;
    const done = completedSets[exercise.id];
    const doneCount = Array.isArray(done) ? done.length : (done?.size ?? 0);
    return doneCount <= 0;
  });
}

function doneSetCount(
  completedSets: Record<string, { size: number } | number[] | undefined>,
  blockId: string,
): number {
  const done = completedSets[blockId];
  if (!done) return 0;
  return Array.isArray(done) ? done.length : done.size;
}

/**
 * "Log workout complete" always writes every countable exercise.
 * Checkoffs are optional: unmarked lines get the prescribed sets so the day
 * still lands as a real completed session (silhouettes + progress 100).
 */
export function buildCompleteWorkoutLog(input: {
  exercises: LoggableWorkoutExercise[];
  finishedIds: Iterable<string>;
  completedSets: Record<string, { size: number } | number[] | undefined>;
  weights: Record<string, string>;
  freeLockedIds?: Iterable<string> | null;
}): {
  exercises: WorkoutLogExercisePayload[];
  progress: 100;
  unfinished: LoggableWorkoutExercise[];
} {
  const countable = countableLogExercises(input.exercises, input.freeLockedIds);
  const unfinished = unfinishedLogExercises(
    input.exercises,
    input.finishedIds,
    input.completedSets,
    input.freeLockedIds,
  );

  const exercises = countable.map((block) => {
    const prescribed = prescribedSetCount(block);
    const done = doneSetCount(input.completedSets, block.id);
    const setsCompleted = Math.max(done, prescribed);
    const startingWeightLbs = parseLogWeightLbs(
      input.weights[block.id],
      block.past?.startingWeightLbs ?? null,
    );
    return {
      workoutExerciseId: block.id,
      exerciseId: block.exerciseId,
      setScheme: block.setScheme,
      repPattern: block.repPattern ?? null,
      reps: block.reps ?? null,
      sets: block.setCount,
      weightTier: block.weightTier,
      startingWeightLbs,
      repsCompleted: repsForLoggedSets(block, setsCompleted),
      setsCompleted,
    };
  });

  return { exercises, progress: 100, unfinished };
}

export function logFailureMessage(err: unknown): string {
  const detail =
    err && typeof err === "object" && "detail" in err
      ? (err as { detail?: unknown }).detail
      : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const fieldErrors = (detail as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
    if (fieldErrors?.sessionDate?.[0]) {
      return "Couldn’t save — the session date was invalid. Try again.";
    }
    const formErrors = (detail as { formErrors?: unknown }).formErrors;
    if (Array.isArray(formErrors) && typeof formErrors[0] === "string" && formErrors[0].trim()) {
      return formErrors[0];
    }
  }
  return "Failed to log workout";
}
