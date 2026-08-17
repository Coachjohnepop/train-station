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
