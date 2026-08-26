/**
 * HIT intervals: work N seconds, rest N (or coach-set) seconds, repeat for R rounds.
 * One Go runs the whole series (work → rest → work → … including rest after last work).
 *
 * Stored on the workout line so it follows the exercise:
 *   setScheme = "hit"
 *   sets / setCount = rounds
 *   reps = "20s" or "20/15" (work/rest)
 *   restSec = rest seconds (optional duplicate of rest in reps)
 */

export const HIT_APPROACH_ID = "hit" as const;

export const HIT_WORK_PRESETS = [10, 15, 20, 30, 45, 60] as const;
export const HIT_REST_PRESETS = [10, 15, 20, 30, 45, 60] as const;
export const HIT_ROUND_COUNTS = [4, 6, 8, 10] as const;

export const DEFAULT_HIT_WORK_SEC = 20;
export const DEFAULT_HIT_ROUNDS = 10;

export type HitInterval = {
  workSec: number;
  restSec: number;
  rounds: number;
  /** Work + rest bouts (2 × rounds). */
  bouts: number;
  totalSeconds: number;
};

export function isHitApproach(approach: string | null | undefined): boolean {
  const a = (approach || "").trim().toLowerCase();
  return a === HIT_APPROACH_ID || a === "hit_intervals" || a === "intervals";
}

function clampSec(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HIT_WORK_SEC;
  return Math.min(180, Math.max(5, Math.round(n)));
}

function clampRounds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_HIT_ROUNDS;
  return Math.min(10, Math.max(1, Math.round(n)));
}

/** Parse "20s", "20/20", "20s/15s", "20 on / 20 off". */
export function parseHitReps(reps: string | null | undefined): {
  workSec: number;
  restSec: number;
} | null {
  if (!reps?.trim()) return null;
  const raw = reps.trim().toLowerCase().replace(/on|off|work|rest|sec(?:ond)?s?/g, " ");
  const pair = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (pair) {
    return { workSec: clampSec(Number(pair[1])), restSec: clampSec(Number(pair[2])) };
  }
  const one = raw.match(/(\d+)/);
  if (one) {
    const n = clampSec(Number(one[1]));
    return { workSec: n, restSec: n };
  }
  return null;
}

export function formatHitReps(workSec: number, restSec: number): string {
  const w = clampSec(workSec);
  const r = clampSec(restSec);
  return w === r ? `${w}s` : `${w}/${r}`;
}

export function resolveHitInterval(input: {
  setScheme?: string | null;
  reps?: string | null;
  setCount?: number | null;
  restSec?: number | null;
}): HitInterval | null {
  if (!isHitApproach(input.setScheme)) return null;
  const parsed = parseHitReps(input.reps);
  const workSec = parsed?.workSec ?? DEFAULT_HIT_WORK_SEC;
  const restSec = parsed?.restSec
    ?? (typeof input.restSec === "number" && input.restSec > 0
      ? clampSec(input.restSec)
      : workSec);
  const rounds = clampRounds(input.setCount ?? DEFAULT_HIT_ROUNDS);
  const bouts = rounds * 2;
  return {
    workSec,
    restSec,
    rounds,
    bouts,
    totalSeconds: rounds * (workSec + restSec),
  };
}

export function formatHitSummary(hit: HitInterval): string {
  const rest =
    hit.workSec === hit.restSec ? `${hit.workSec}s` : `${hit.workSec}s / ${hit.restSec}s rest`;
  const mins = Math.floor(hit.totalSeconds / 60);
  const secs = hit.totalSeconds % 60;
  const clock = secs === 0 ? `${mins}:00` : `${mins}:${String(secs).padStart(2, "0")}`;
  return `${hit.rounds} × ${rest} · ${clock}`;
}

export function formatHitTotalLabel(hit: HitInterval): string {
  return `${hit.bouts} countdowns · ${hit.totalSeconds}s total`;
}
