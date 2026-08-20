import "server-only";

import { formatLongDate, localTodayIso, parseIsoDate } from "@/lib/program-calendar";
import { getProgramBySlug } from "@/lib/program-data";
import { normalizeProgramSlug } from "@/lib/programs";
import { getUserEnrollments } from "@/lib/data/user-data";
import { linearEnrollmentDay, parseEnrollmentDayKey } from "@/lib/member-enrollment-day";
import {
  calendarDateForBlockDay,
  personalCoordinateForCalendarDate,
} from "@/lib/member-program-block";
import { memberScheduleLabel } from "@/lib/member-day-window";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";

export type MemberWorkoutContext = {
  calendarDate: string;
  calendarDateLabel: string;
  scheduleLabel?: string;
  dayOptionNotes?: string | null;
  isToday: boolean;
};

export async function resolveMemberWorkoutContext(input: {
  programSlug?: string;
  dateParam?: string;
  optionLabel?: string;
  userId?: string;
}): Promise<MemberWorkoutContext | null> {
  if (!input.programSlug) return null;

  const todayIso = localTodayIso();
  const dateParam = input.dateParam?.trim() || todayIso;
  const enrollmentCoord = parseEnrollmentDayKey(dateParam);
  const program = await getProgramBySlug(normalizeProgramSlug(input.programSlug));
  if (!program) return null;

  let scheduleLabel: string | undefined;
  let calendarDate = dateParam;
  let dayOptionNotes: string | null = null;

  if (enrollmentCoord) {
    scheduleLabel = memberScheduleLabel(
      program.name,
      enrollmentCoord.weekNumber,
      enrollmentCoord.dayNumber,
    );
    calendarDate = todayIso;
    if (input.userId) {
      const enrolls = await getUserEnrollments(input.userId);
      const startIso =
        enrolls[normalizeProgramSlug(input.programSlug)]?.programStartDate ?? null;
      if (startIso) {
        calendarDate = calendarDateForBlockDay(
          startIso,
          linearEnrollmentDay(enrollmentCoord.weekNumber, enrollmentCoord.dayNumber),
        );
      }
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    calendarDate = dateParam;
    const parsed = parseIsoDate(dateParam);
    if (Number.isNaN(parsed.getTime())) return null;

    let startIso: string | null = null;
    if (input.userId) {
      const enrolls = await getUserEnrollments(input.userId);
      startIso = enrolls[normalizeProgramSlug(input.programSlug)]?.programStartDate ?? null;
    }
    const startSettings = programStartSettingsFromCoach(await getCoachSettings());
    const personal = personalCoordinateForCalendarDate(
      startIso || dateParam,
      dateParam,
      program.durationWeeks,
      startSettings.blockDays,
    );
    if (personal) {
      scheduleLabel = memberScheduleLabel(program.name, personal.weekNumber, personal.dayNumber);
    }
  } else {
    return null;
  }

  return {
    calendarDate,
    calendarDateLabel: formatLongDate(calendarDate),
    scheduleLabel,
    dayOptionNotes,
    isToday: calendarDate === todayIso,
  };
}