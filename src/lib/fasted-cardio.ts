/** Fasted cardio is one timed block — not 3 strength sets. */

export const DEFAULT_FASTED_CARDIO_MINUTES = 35;

export function isFastedCardioName(name: string | null | undefined): boolean {
  return /fasted\s*cardio/i.test(String(name || ""));
}

export function fastedCardioMinutesFromText(
  ...texts: Array<string | null | undefined>
): number {
  for (const text of texts) {
    const m = String(text || "").match(/(\d+)\s*(min|mins|minute|minutes)\b/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) return Math.min(90, Math.max(5, n));
    }
  }
  return DEFAULT_FASTED_CARDIO_MINUTES;
}

export function isFastedCardioBlock(input: {
  name?: string | null;
  notes?: string | null;
  reps?: string | null;
}): boolean {
  if (isFastedCardioName(input.name) || isFastedCardioName(input.notes)) return true;
  return /fasted\s*cardio/i.test(String(input.reps || ""));
}
