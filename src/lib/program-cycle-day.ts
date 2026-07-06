import { DAYS_PER_WEEK, PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";

export type CycleCoordinate = {
  cycleMonth: number;
  cycleDay: number;
};

/** Linear program day index (M1D1 = 1, M1D28 = 28, M2D1 = 29, …). */
export function linearFromCycle(cycleMonth: number, cycleDay: number): number {
  const month = Math.max(1, Math.floor(cycleMonth));
  const day = Math.min(PROGRAM_CYCLE_DAYS, Math.max(1, Math.floor(cycleDay)));
  return (month - 1) * PROGRAM_CYCLE_DAYS + day;
}

/** Map linear day → month + day within the 28-day cycle (M1D28 …). */
export function cycleFromLinear(linearDay: number): CycleCoordinate {
  const linear = Math.max(1, Math.floor(linearDay));
  return {
    cycleMonth: Math.floor((linear - 1) / PROGRAM_CYCLE_DAYS) + 1,
    cycleDay: ((linear - 1) % PROGRAM_CYCLE_DAYS) + 1,
  };
}

export function cycleDayKey(cycleMonth: number, cycleDay: number): string {
  return `M${Math.max(1, Math.floor(cycleMonth))}D${Math.min(PROGRAM_CYCLE_DAYS, Math.max(1, Math.floor(cycleDay)))}`;
}

export function formatCycleDayLabel(cycleMonth: number, cycleDay: number): string {
  return cycleDayKey(cycleMonth, cycleDay);
}

export function formatCycleDayFromLinear(linearDay: number): string {
  const { cycleMonth, cycleDay } = cycleFromLinear(linearDay);
  return cycleDayKey(cycleMonth, cycleDay);
}

export function formatCycleDayFromWeekDay(weekNumber: number, dayNumber: number): string {
  const linear = (weekNumber - 1) * DAYS_PER_WEEK + dayNumber;
  return formatCycleDayFromLinear(linear);
}

export function parseCycleDayKey(value: string): CycleCoordinate | null {
  const match = value.trim().match(/^M(\d+)D(\d+)$/i);
  if (!match) return null;
  const cycleMonth = Number(match[1]);
  const cycleDay = Number(match[2]);
  if (!Number.isFinite(cycleMonth) || !Number.isFinite(cycleDay)) return null;
  if (cycleMonth < 1 || cycleDay < 1 || cycleDay > PROGRAM_CYCLE_DAYS) return null;
  return { cycleMonth, cycleDay };
}

/** Map M1D* → program week + weekday (Mon=1 … Sun=7). */
export function weekDayFromCycle(
  cycleMonth: number,
  cycleDay: number,
): { weekNumber: number; dayNumber: number } {
  const linear = linearFromCycle(cycleMonth, cycleDay);
  return {
    weekNumber: Math.floor((linear - 1) / DAYS_PER_WEEK) + 1,
    dayNumber: ((linear - 1) % DAYS_PER_WEEK) + 1,
  };
}

export function cycleFromWeekDay(weekNumber: number, dayNumber: number): CycleCoordinate {
  const linear = (weekNumber - 1) * DAYS_PER_WEEK + dayNumber;
  return cycleFromLinear(linear);
}