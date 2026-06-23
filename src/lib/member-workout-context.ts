import "server-only";

import { DAY_LABELS } from "@/lib/program-constants";
import {
  findProgramDayForCalendarDate,
  formatLongDate,
  localTodayIso,
  parseIsoDate,
} from "@/lib/program-calendar";
import { getProgramBySlug } from "@/lib/program-data";
import { normalizeProgramSlug } from "@/lib/programs";

export type MemberWorkoutContext = {
  calendarDate: string;
  calendarDateLabel: string;
  scheduleLabel?: string;
  isToday: boolean;
};

export async function resolveMemberWorkoutContext(input: {
  programSlug?: string;
  dateParam?: string;
}): Promise<MemberWorkoutContext | null> {
  if (!input.programSlug) return null;

  const calendarDate = input.dateParam || localTodayIso();
  const parsed = parseIsoDate(calendarDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const program = await getProgramBySlug(normalizeProgramSlug(input.programSlug));
  if (!program) return null;

  const match = findProgramDayForCalendarDate(program, calendarDate);
  const scheduleLabel = match
    ? `Week ${match.weekNumber} · ${DAY_LABELS[match.dayNumber - 1] ?? `Day ${match.dayNumber}`}`
    : undefined;

  const todayIso = localTodayIso();
  return {
    calendarDate,
    calendarDateLabel: formatLongDate(calendarDate),
    scheduleLabel,
    isToday: calendarDate === todayIso,
  };
}