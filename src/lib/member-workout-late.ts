import { addDaysIso } from "@/lib/workout-day-visibility";

/** Late catch-up: 20% score hit on the whole workout_logged award. */
export const LATE_WORKOUT_SCORE_MULTIPLIER = 0.8;
export const LATE_WORKOUT_SCORE_HIT_PERCENT = 20;

/** Today ± 1 day only (3 total). */
export function memberTodaySwipeWindow(todayIso: string): {
  yesterday: string;
  today: string;
  tomorrow: string;
} {
  return {
    yesterday: addDaysIso(todayIso, -1),
    today: todayIso,
    tomorrow: addDaysIso(todayIso, 1),
  };
}

export function isLateSessionDate(sessionDate: string, todayIso: string): boolean {
  return Boolean(sessionDate && todayIso && sessionDate < todayIso);
}

export function isFutureSessionDate(sessionDate: string, todayIso: string): boolean {
  return Boolean(sessionDate && todayIso && sessionDate > todayIso);
}

/**
 * From Today: may log today or yesterday only.
 * Tomorrow is preview — cannot log until that calendar day.
 */
export function canLogSessionDate(
  sessionDate: string,
  todayIso: string,
): { ok: true } | { ok: false; reason: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return { ok: false, reason: "Invalid session date." };
  }
  if (isFutureSessionDate(sessionDate, todayIso)) {
    return { ok: false, reason: "That day isn’t open yet — come back tomorrow." };
  }
  const { yesterday } = memberTodaySwipeWindow(todayIso);
  if (sessionDate < yesterday) {
    return {
      ok: false,
      reason: "Only yesterday and today can be worked from Today (3-day window).",
    };
  }
  return { ok: true };
}

/** Whether the full workout console should open for this date. */
export function canStartSessionDate(sessionDate: string, todayIso: string): boolean {
  return canLogSessionDate(sessionDate, todayIso).ok;
}

export function lateAdjustedPoints(
  basePoints: number,
  sessionDate: string,
  todayIso: string,
): { points: number; late: boolean; hitPercent: number } {
  const base = Math.max(0, Math.round(basePoints));
  if (!isLateSessionDate(sessionDate, todayIso)) {
    return { points: base, late: false, hitPercent: 0 };
  }
  return {
    points: Math.max(0, Math.round(base * LATE_WORKOUT_SCORE_MULTIPLIER)),
    late: true,
    hitPercent: LATE_WORKOUT_SCORE_HIT_PERCENT,
  };
}

export function lateScoreLabel(hitPercent = LATE_WORKOUT_SCORE_HIT_PERCENT): string {
  return `Workout logged (late −${hitPercent}%)`;
}
