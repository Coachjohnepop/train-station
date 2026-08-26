import { addDaysIso } from "@/lib/workout-day-visibility";

/** Late catch-up: 20% score hit — unused while catch-up logs as today. */
export const LATE_WORKOUT_SCORE_MULTIPLIER = 0.8;
export const LATE_WORKOUT_SCORE_HIT_PERCENT = 20;

/** Program days a member may open and complete from Today. */
export const MEMBER_CATCH_UP_DAYS = 5;
export const MEMBER_UPCOMING_PREVIEW_DAYS = 1;

/** Today ± 1 day (legacy 3-chip window). */
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

export function memberCatchUpStartIso(todayIso: string): string {
  return addDaysIso(todayIso, -MEMBER_CATCH_UP_DAYS);
}

export function isCatchUpSessionDate(sessionDate: string, todayIso: string): boolean {
  return Boolean(sessionDate && todayIso && sessionDate < todayIso);
}

export function isLateSessionDate(sessionDate: string, todayIso: string): boolean {
  return isCatchUpSessionDate(sessionDate, todayIso);
}

export function isFutureSessionDate(sessionDate: string, todayIso: string): boolean {
  return Boolean(sessionDate && todayIso && sessionDate > todayIso);
}

/**
 * From Today: last 5 calendar days + today may be worked.
 * Tomorrow is preview — cannot log until that calendar day.
 * Catch-up still stamps the log as today (the day they actually trained).
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
  const start = memberCatchUpStartIso(todayIso);
  if (sessionDate < start) {
    return {
      ok: false,
      reason: `Only the last ${MEMBER_CATCH_UP_DAYS} days plus today can be worked from Today.`,
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
  _sessionDate: string,
  _todayIso: string,
): { points: number; late: boolean; hitPercent: number } {
  // Catch-up logs as today — full points. The old 20% late hit is parked.
  const base = Math.max(0, Math.round(basePoints));
  return { points: base, late: false, hitPercent: 0 };
}

export function lateScoreLabel(hitPercent = LATE_WORKOUT_SCORE_HIT_PERCENT): string {
  return `Workout logged (late −${hitPercent}%)`;
}
