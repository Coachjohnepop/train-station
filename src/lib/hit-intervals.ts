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
  /** Work + rest bouts (2 × rounds, or 2×rounds−1 if last rest is dropped). */
  bouts: number;
  totalSeconds: number;
  /** Named “5 Min HIIT”: skip rest after the last work so the clock matches. */
  omitLastRest: boolean;
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
  return Math.min(15, Math.max(1, Math.round(n)));
}

function parseNamedDurationSec(text: string): number | null {
  const min = text.match(/(\d+(?:\.\d+)?)\s*min/i);
  if (min) {
    const n = Number(min[1]);
    if (Number.isFinite(n) && n > 0 && n <= 30) return Math.round(n * 60);
  }
  return null;
}

/** Parse "20s", "20/20", "20s/15s", "20 on / 20 off". */
export function parseHitReps(reps: string | null | undefined): {
  workSec: number;
  restSec: number;
} | null {
  if (!reps?.trim()) return null;
  const raw = reps.trim().toLowerCase();
  const pair =
    raw.match(/(\d+)\s*\/\s*(\d+)/) ||
    raw.match(/(\d+)\s*(?:s|sec(?:ond)?s?)?\s*on\s*(\d+)/);
  if (pair) {
    return { workSec: clampSec(Number(pair[1])), restSec: clampSec(Number(pair[2])) };
  }
  const interval = raw.match(/(\d+)\s*(?:s|sec(?:ond)?s?)\s*intervals?/);
  if (interval) {
    const n = clampSec(Number(interval[1]));
    return { workSec: n, restSec: n };
  }
  const one = raw.match(/(\d+)\s*(?:s|sec(?:ond)?s?)\b/);
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
  name?: string | null;
  notes?: string | null;
  reps?: string | null;
  setCount?: number | null;
  restSec?: number | null;
}): HitInterval | null {
  const blob = [input.name, input.notes, input.reps].filter(Boolean).join(" ");
  const explicit = isHitApproach(input.setScheme);
  const namedHiit = /\bhiit\b/i.test(blob);
  const intervalText = /\bintervals?\b/i.test(blob);
  if (!explicit && !namedHiit && !intervalText) return null;

  const parsed = parseHitReps(input.reps) ?? parseHitReps(blob);
  const workSec = parsed?.workSec ?? DEFAULT_HIT_WORK_SEC;
  const restSec = parsed?.restSec
    ?? (typeof input.restSec === "number" && input.restSec > 0
      ? clampSec(input.restSec)
      : workSec);

  const namedDuration = parseNamedDurationSec(blob);
  const explicitRounds = input.setCount != null && input.setCount > 1 ? input.setCount : null;
  let rounds = explicitRounds;
  let omitLastRest = false;
  if (rounds == null && namedDuration) {
    // Fit work/rest into the named duration (5 Min HIIT × 20/20 → 8 work + 7 rest = 5:00).
    rounds = Math.max(1, Math.round((namedDuration + restSec) / (workSec + restSec)));
    omitLastRest = true;
  }
  if (rounds == null) {
    if (!explicit && !namedDuration) return null;
    rounds = DEFAULT_HIT_ROUNDS;
  }
  rounds = clampRounds(rounds);

  const totalSeconds = omitLastRest
    ? rounds * workSec + Math.max(0, rounds - 1) * restSec
    : rounds * (workSec + restSec);
  const bouts = omitLastRest ? rounds * 2 - 1 : rounds * 2;
  return {
    workSec,
    restSec,
    rounds,
    bouts,
    totalSeconds,
    omitLastRest,
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
