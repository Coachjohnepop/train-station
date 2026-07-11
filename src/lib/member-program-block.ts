import { PROGRAM_CYCLE_DAYS } from "@/lib/program-constants";
import {
  coordinateFromEnrollmentDay,
  linearEnrollmentDay,
} from "@/lib/member-enrollment-day";
import { parseIsoDate } from "@/lib/program-calendar";
import { addDaysIso, daysFromToday } from "@/lib/workout-day-visibility";

/** Latest day (inclusive) a new member may schedule program start after payment. */
export const MAX_PROGRAM_START_OFFSET_DAYS = 6;

export type ProgramBlockStatus = "pending" | "active" | "expired";

export type ProgramBlockEnrollment = {
  currentWeek: number;
  currentDay: number;
  programStartDate?: string | null;
  blockEndsAt?: string | null;
};

export type ResolvedProgramBlock = {
  status: ProgramBlockStatus;
  programStartDate: string;
  blockEndsAt: string;
  /** Linear program day 1–28 while active; 0 before start; 28 when expired. */
  linearDay: number;
  weekNumber: number;
  dayNumber: number;
  daysUntilStart: number;
  daysRemaining: number;
};

function parseIsoDateOnly(iso: string): Date {
  return parseIsoDate(iso);
}

export function blockEndDateFromStart(startIso: string): string {
  return addDaysIso(startIso, PROGRAM_CYCLE_DAYS - 1);
}

export function isValidProgramStartDate(
  startIso: string,
  todayIso: string,
  maxOffset = MAX_PROGRAM_START_OFFSET_DAYS,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) return false;
  const offset = daysFromToday(startIso, todayIso);
  return offset >= 0 && offset <= maxOffset;
}

/** Allowed start dates from today through +maxOffset days (inclusive). */
export function allowedProgramStartDates(
  todayIso: string,
  maxOffset = MAX_PROGRAM_START_OFFSET_DAYS,
): string[] {
  const out: string[] = [];
  for (let i = 0; i <= maxOffset; i++) {
    out.push(addDaysIso(todayIso, i));
  }
  return out;
}

export function formatProgramStartOption(iso: string): string {
  const d = parseIsoDateOnly(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function resolveProgramBlock(
  enrollment: ProgramBlockEnrollment,
  todayIso: string,
  durationWeeks = 4,
): ResolvedProgramBlock {
  const start = enrollment.programStartDate?.trim() || todayIso;
  const end = enrollment.blockEndsAt?.trim() || blockEndDateFromStart(start);
  const untilStart = daysFromToday(start, todayIso);
  const untilEnd = daysFromToday(end, todayIso);

  if (untilStart > 0) {
    return {
      status: "pending",
      programStartDate: start,
      blockEndsAt: end,
      linearDay: 0,
      weekNumber: 1,
      dayNumber: 1,
      daysUntilStart: untilStart,
      daysRemaining: PROGRAM_CYCLE_DAYS,
    };
  }

  if (untilEnd < 0) {
    const last = coordinateFromEnrollmentDay(PROGRAM_CYCLE_DAYS, durationWeeks);
    return {
      status: "expired",
      programStartDate: start,
      blockEndsAt: end,
      linearDay: PROGRAM_CYCLE_DAYS,
      weekNumber: last?.weekNumber ?? 4,
      dayNumber: last?.dayNumber ?? 7,
      daysUntilStart: 0,
      daysRemaining: 0,
    };
  }

  const linearDay = Math.min(PROGRAM_CYCLE_DAYS, Math.max(1, -untilStart + 1));
  const coord =
    coordinateFromEnrollmentDay(linearDay, durationWeeks) ?? {
      weekNumber: enrollment.currentWeek,
      dayNumber: enrollment.currentDay,
    };

  return {
    status: "active",
    programStartDate: start,
    blockEndsAt: end,
    linearDay,
    weekNumber: coord.weekNumber,
    dayNumber: coord.dayNumber,
    daysUntilStart: 0,
    daysRemaining: Math.max(0, untilEnd + 1),
  };
}

/** Calendar ISO for a given linear day (1-based) within the member's block. */
export function calendarDateForBlockDay(programStartDate: string, linearDay: number): string {
  return addDaysIso(programStartDate, Math.max(0, linearDay - 1));
}

export function linearDayForCalendarDate(
  programStartDate: string,
  calendarIso: string,
): number | null {
  const offset = daysFromToday(calendarIso, programStartDate);
  if (offset < 0 || offset >= PROGRAM_CYCLE_DAYS) return null;
  return offset + 1;
}

export function enrollmentDayKeyForLinear(linearDay: number, durationWeeks: number): string {
  const coord = coordinateFromEnrollmentDay(linearDay, durationWeeks);
  if (!coord) return `D${linearDay}`;
  return `W${coord.weekNumber}D${coord.dayNumber}`;
}

export function effectiveEnrollmentPosition(
  enrollment: ProgramBlockEnrollment,
  todayIso: string,
  durationWeeks = 4,
): { currentWeek: number; currentDay: number; linearDay: number; block: ResolvedProgramBlock } {
  const block = resolveProgramBlock(enrollment, todayIso, durationWeeks);
  return {
    currentWeek: block.weekNumber,
    currentDay: block.dayNumber,
    linearDay: block.linearDay,
    block,
  };
}

export function blockPhaseForCalendarDate(
  calendarIso: string,
  todayIso: string,
): "past" | "today" | "future" {
  const offset = daysFromToday(calendarIso, todayIso);
  if (offset < 0) return "past";
  if (offset === 0) return "today";
  return "future";
}

export function linearEnrollmentDayFromBlock(
  weekNumber: number,
  dayNumber: number,
): number {
  return linearEnrollmentDay(weekNumber, dayNumber);
}