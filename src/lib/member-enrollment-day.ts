import { DAYS_PER_WEEK } from "@/lib/program-constants";

export type EnrollmentCoordinate = {
  weekNumber: number;
  dayNumber: number;
};

export type EnrollmentDayPhase = "past" | "today" | "future";

export type RollingEnrollmentDay<T = unknown> = {
  key: string;
  weekNumber: number;
  dayNumber: number;
  enrollmentDayNumber: number;
  day: T;
  phase: EnrollmentDayPhase;
  offset: number;
};

/** Linear day index from enrollment start (W1D1 = 1, W2D1 = 8, …). */
export function linearEnrollmentDay(weekNumber: number, dayNumber: number): number {
  return (weekNumber - 1) * DAYS_PER_WEEK + dayNumber;
}

export function enrollmentDayKey(weekNumber: number, dayNumber: number): string {
  return `W${weekNumber}D${dayNumber}`;
}

export function parseEnrollmentDayKey(
  value: string,
): EnrollmentCoordinate | null {
  const match = value.trim().match(/^W(\d+)D(\d+)$/i);
  if (!match) return null;
  const weekNumber = Number(match[1]);
  const dayNumber = Number(match[2]);
  if (!Number.isFinite(weekNumber) || !Number.isFinite(dayNumber)) return null;
  if (weekNumber < 1 || dayNumber < 1 || dayNumber > DAYS_PER_WEEK) return null;
  return { weekNumber, dayNumber };
}

/** Move by program-day offsets within [W1D1 … W{durationWeeks}D7]. */
export function offsetEnrollmentDay(
  weekNumber: number,
  dayNumber: number,
  delta: number,
  durationWeeks: number,
): EnrollmentCoordinate | null {
  if (durationWeeks < 1) return null;
  const linear = (weekNumber - 1) * DAYS_PER_WEEK + (dayNumber - 1) + delta;
  const maxLinear = durationWeeks * DAYS_PER_WEEK - 1;
  if (linear < 0 || linear > maxLinear) return null;
  return {
    weekNumber: Math.floor(linear / DAYS_PER_WEEK) + 1,
    dayNumber: (linear % DAYS_PER_WEEK) + 1,
  };
}

export function rollingEnrollmentProgramDays<
  T extends {
    dayNumber: number;
    workoutId?: string | null;
    workout?: { id: string; name?: string } | null;
    options?: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>;
  },
>(
  programWeeks: Array<{ weekNumber: number; days: T[] }>,
  center: EnrollmentCoordinate,
  durationWeeks: number,
  windowDays = 5,
  daysBefore = 2,
): RollingEnrollmentDay<T>[] {
  const daysAfter = Math.max(0, windowDays - 1 - daysBefore);
  const out: RollingEnrollmentDay<T>[] = [];

  for (let offset = -daysBefore; offset <= daysAfter; offset++) {
    const coord = offsetEnrollmentDay(
      center.weekNumber,
      center.dayNumber,
      offset,
      durationWeeks,
    );
    if (!coord) continue;

    const week = programWeeks.find((w) => w.weekNumber === coord.weekNumber);
    const day = week?.days.find((d) => d.dayNumber === coord.dayNumber);
    if (!week || !day) continue;

    const phase: EnrollmentDayPhase =
      offset < 0 ? "past" : offset === 0 ? "today" : "future";

    out.push({
      key: enrollmentDayKey(coord.weekNumber, coord.dayNumber),
      weekNumber: coord.weekNumber,
      dayNumber: coord.dayNumber,
      enrollmentDayNumber: linearEnrollmentDay(coord.weekNumber, coord.dayNumber),
      day,
      phase,
      offset,
    });
  }

  return out;
}