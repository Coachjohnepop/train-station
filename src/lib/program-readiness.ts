import "server-only";

import {
  assessProgramDayReadiness,
  type DayReadiness,
  type ProgramDayLike,
} from "@/lib/program-day-readiness";
import { todayProgramDayIndex } from "@/lib/program-calendar";

export type ProgramWeekLike = {
  id: string;
  weekNumber: number;
  days: ProgramDayLike[];
};

export type ProgramReadinessInput = {
  slug: string;
  name: string;
  durationWeeks?: number;
  startDate?: string | null;
  weeks: ProgramWeekLike[];
};

export type WeekReadiness = {
  weekNumber: number;
  complete: boolean;
  publishedCount: number;
  incompleteDays: Array<{
    dayId: string;
    dayNumber: number;
    readiness: DayReadiness;
  }>;
};

export type ProgramReadiness = {
  anchorWeek: number;
  calendarWeek: number;
  enrollmentMaxWeek: number;
  currentWeek: WeekReadiness | null;
  nextWeek: WeekReadiness | null;
  currentWeekComplete: boolean;
  nextWeekComplete: boolean;
  isCurrentWithClients: boolean;
  alertLevel: "ok" | "warn" | "critical";
  incompleteDayCount: number;
};

function assessWeekReadiness(week: ProgramWeekLike | undefined): WeekReadiness | null {
  if (!week) return null;
  const incompleteDays = week.days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      day,
      readiness: assessProgramDayReadiness(day),
    }))
    .filter(({ readiness }) => !readiness.complete)
    .map(({ day, readiness }) => ({
      dayId: day.id,
      dayNumber: day.dayNumber,
      readiness,
    }));

  const publishedCount = week.days.filter((d) => d.publishedAt).length;

  return {
    weekNumber: week.weekNumber,
    complete: incompleteDays.length === 0,
    publishedCount,
    incompleteDays,
  };
}

export function resolveContentAnchorWeek(
  program: ProgramReadinessInput,
  enrollmentMaxWeek = 1,
): { anchorWeek: number; calendarWeek: number } {
  const calendarWeek = todayProgramDayIndex(program.startDate)?.weekNumber ?? 1;
  const maxWeek = program.durationWeeks || program.weeks.length || 4;
  const anchorWeek = Math.min(
    maxWeek,
    Math.max(calendarWeek, enrollmentMaxWeek, 1),
  );
  return { anchorWeek, calendarWeek };
}

export function assessProgramReadiness(
  program: ProgramReadinessInput,
  enrollmentMaxWeek = 1,
): ProgramReadiness {
  const { anchorWeek, calendarWeek } = resolveContentAnchorWeek(program, enrollmentMaxWeek);
  const weekByNumber = new Map(program.weeks.map((w) => [w.weekNumber, w]));
  const currentWeek = assessWeekReadiness(weekByNumber.get(anchorWeek));
  const nextWeekNumber = Math.min(
    program.durationWeeks || program.weeks.length || anchorWeek + 1,
    anchorWeek + 1,
  );
  const nextWeek = assessWeekReadiness(weekByNumber.get(nextWeekNumber));

  const currentWeekComplete = currentWeek?.complete ?? false;
  const nextWeekComplete = nextWeek?.complete ?? false;
  const isCurrentWithClients = currentWeekComplete && nextWeekComplete;

  const incompleteDayCount =
    (currentWeek?.incompleteDays.length ?? 0) + (nextWeek?.incompleteDays.length ?? 0);

  let alertLevel: ProgramReadiness["alertLevel"] = "ok";
  if (!currentWeekComplete) alertLevel = "critical";
  else if (!nextWeekComplete) alertLevel = "warn";

  return {
    anchorWeek,
    calendarWeek,
    enrollmentMaxWeek,
    currentWeek,
    nextWeek,
    currentWeekComplete,
    nextWeekComplete,
    isCurrentWithClients,
    alertLevel,
    incompleteDayCount,
  };
}