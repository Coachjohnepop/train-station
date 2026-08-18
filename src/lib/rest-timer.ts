/** Coach-configured rest between sets (whole workout). */
export const REST_TIMER_PRESETS = [
  { seconds: 30, label: "30 sec" },
  { seconds: 45, label: "45 sec" },
  { seconds: 60, label: "1 min" },
  { seconds: 90, label: "1:30" },
  { seconds: 120, label: "2 min" },
  { seconds: 180, label: "3 min" },
] as const;

/** Default when coach has not set per-exercise rest (still skippable). */
export const DEFAULT_REST_TIMER_SECONDS = 45;

/**
 * Parse a timed-hold duration from prescription text: "45s", "90 sec", "2 min", "1:30".
 * Does NOT treat a work cue like "5 min bike" as a post-set hold — callers must
 * only use this when the set approach is actually timed.
 */
export function parseHoldDurationSeconds(reps: string | null | undefined): number | null {
  if (!reps?.trim()) return null;
  const raw = reps.trim().toLowerCase();
  const mmss = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (mmss) {
    const total = Number(mmss[1]) * 60 + Number(mmss[2]);
    if (Number.isFinite(total) && total >= 5 && total <= 1800) return total;
  }
  const min = raw.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (min) {
    const n = Number(min[1]);
    if (Number.isFinite(n) && n > 0 && n <= 30) return Math.round(n * 60);
  }
  const sec = raw.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/);
  if (sec) {
    const n = Number(sec[1]);
    if (Number.isFinite(n) && n >= 5 && n <= 1800) return Math.round(n);
  }
  return null;
}

export function formatRestCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function normalizeRestTimerSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 15) return DEFAULT_REST_TIMER_SECONDS;
  return Math.min(600, Math.round(n));
}

/**
 * Resolve rest duration after a completed set.
 * - exercise restSec > 0 → use it
 * - exercise restSec === 0 → disabled for this exercise
 * - workout-level timer enabled → use workout seconds
 * - otherwise default (so coach + member always get a countdown unless explicitly off)
 */
export function resolveRestSeconds(input: {
  exerciseRestSec?: number | null;
  workoutRestEnabled?: boolean;
  workoutRestSeconds?: number | null;
}): number | null {
  if (typeof input.exerciseRestSec === "number") {
    if (input.exerciseRestSec <= 0) return null;
    return normalizeRestTimerSeconds(input.exerciseRestSec);
  }
  if (
    input.workoutRestEnabled &&
    typeof input.workoutRestSeconds === "number" &&
    input.workoutRestSeconds > 0
  ) {
    return normalizeRestTimerSeconds(input.workoutRestSeconds);
  }
  return DEFAULT_REST_TIMER_SECONDS;
}

/**
 * Green "Time of Exercise" hold after a set tap.
 * Only for timed-approach sets (plank / hold). "5 min" on a standard bike
 * set is the work itself — checking it must start rest, not another 5-min hold.
 */
export function resolveExerciseHoldSeconds(input: {
  setScheme?: string | null;
  reps?: string | null;
  setCount?: number | null;
  timedApproach?: boolean;
}): number | null {
  if (!input.timedApproach) return null;
  const fromReps = parseHoldDurationSeconds(input.reps);
  if (fromReps != null) return fromReps;
  const mins = Number(input.setCount);
  if (!Number.isFinite(mins) || mins < 1) return null;
  return Math.min(30, Math.max(1, Math.round(mins))) * 60;
}
