import "server-only";

import { getUserEnrollments } from "@/lib/data/user-data";
import { getProgramBySlug } from "@/lib/program-data";
import {
  findProgramDayForCalendarDate,
  formatShortDate,
  localTodayIso,
} from "@/lib/program-calendar";
import { normalizeProgramSlug } from "@/lib/programs";
import { enrollmentDayKey, linearEnrollmentDay } from "@/lib/member-enrollment-day";
import {
  linearMacroEnrollmentDay,
  macroPhasesForProgramSlug,
  pickWorkoutOptionByLocation,
} from "@/lib/program-macro-cycle";
import {
  getSessionForUserOnDate,
  hydrateTodaySessions,
} from "@/lib/today-sessions";
import {
  dayWorkoutOptions,
  resolveDayWorkoutForEnrollment,
  type ResolvedProgramWorkout,
} from "@/lib/member-program-workout";

export type GoToTodayTarget = {
  href: string;
  kind: "sms" | "program" | "empty";
  title: string;
  subtitle?: string;
  calendarDate: string;
  programSlug?: string;
  workoutId?: string;
};

function pickWorkoutForDay(
  day: {
    workoutId?: string | null;
    workout?: { id: string; name?: string } | null;
    options?: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>;
  },
  location: "gym" | "home" = "gym",
): ResolvedProgramWorkout | null {
  const opts = dayWorkoutOptions(day);
  if (!opts.length) return null;
  const pick = pickWorkoutOptionByLocation(opts, location);
  if (!pick?.workoutId) return null;
  return {
    workoutId: pick.workoutId,
    option: pick.label,
    weekNumber: 0,
    dayNumber: 0,
    workoutName: pick.workout?.name || day.workout?.name,
  };
}

export function resolveProgramWorkoutForCalendarDate(
  program: NonNullable<Awaited<ReturnType<typeof getProgramBySlug>>>,
  isoDate: string,
): (ResolvedProgramWorkout & { dayId: string; smsOverride?: boolean }) | null {
  const match = findProgramDayForCalendarDate(program, isoDate);
  if (!match) return null;

  if (match.day.smsOverrideActive) {
    return {
      workoutId: "",
      option: match.day.smsOverrideLabel || "Coach SMS",
      weekNumber: match.weekNumber,
      dayNumber: match.dayNumber,
      workoutName: match.day.smsOverrideLabel || "Coach SMS workout",
      dayId: match.day.id,
      smsOverride: true,
    };
  }

  const pick = pickWorkoutForDay(match.day);
  if (!pick) return null;

  return {
    ...pick,
    weekNumber: match.weekNumber,
    dayNumber: match.dayNumber,
    dayId: match.day.id,
  };
}

export function memberWorkoutHref(input: {
  programSlug: string;
  workoutId?: string;
  option?: string;
  smsDayId?: string;
  calendarDate?: string;
}): string {
  const slug = normalizeProgramSlug(input.programSlug);
  const params = new URLSearchParams({ program: slug });
  if (input.smsDayId) {
    params.set("smsDay", input.smsDayId);
  } else if (input.workoutId) {
    params.set("workoutId", input.workoutId);
  }
  if (input.option) params.set("option", input.option);
  if (input.calendarDate) params.set("date", input.calendarDate);
  return `/member/workout?${params.toString()}`;
}

async function enrollmentSlugsForUser(userId: string): Promise<string[]> {
  const enrolls = await getUserEnrollments(userId);
  const slugs = Object.keys(enrolls);
  return slugs.sort((a, b) => {
    if (a === "adult") return -1;
    if (b === "adult") return 1;
    return a.localeCompare(b);
  });
}

/** Where "Go to Today" should land for a member on the real calendar date. */
export async function resolveMemberGoToToday(
  userId: string,
  reference = new Date(),
): Promise<GoToTodayTarget> {
  await hydrateTodaySessions({ preferFresh: true });
  const calendarDate = localTodayIso(reference);

  const smsToday = getSessionForUserOnDate(userId, calendarDate);
  if (smsToday) {
    return {
      href: "/member/today",
      kind: "sms",
      title: smsToday.title,
      subtitle: formatShortDate(calendarDate),
      calendarDate,
      programSlug: smsToday.programSlug,
      workoutId: smsToday.workoutId,
    };
  }

  const enrolls = await getUserEnrollments(userId);
  for (const slug of await enrollmentSlugsForUser(userId)) {
    const program = await getProgramBySlug(slug);
    if (!program) continue;
    const cat = (program.category || "workout") as string;
    if (cat !== "workout" && cat !== "journey" && cat !== "yoga") continue;

    const enrollment = enrolls[slug] || {
      currentWeek: 1,
      currentDay: 1,
      currentPhase: 1,
      trainingLocation: "gym" as const,
    };
    const phases = macroPhasesForProgramSlug(slug);
    const dayN = phases.length
      ? linearMacroEnrollmentDay(
          phases,
          enrollment.currentPhase ?? 1,
          enrollment.currentWeek,
          enrollment.currentDay,
        )
      : linearEnrollmentDay(enrollment.currentWeek, enrollment.currentDay);
    const resolved = resolveDayWorkoutForEnrollment(program, slug, enrollment);
    if (!resolved) continue;

    return {
      href: "/member/today",
      kind: "program",
      title: resolved.workoutName || program.name,
      subtitle: `${program.name} · Day ${dayN}`,
      calendarDate,
      programSlug: slug,
      workoutId: resolved.workoutId || undefined,
    };
  }

  const fallbackSlug = (await enrollmentSlugsForUser(userId))[0];
  return {
    href: "/member/today",
    kind: "empty",
    title: "No workout on today's calendar",
    subtitle: formatShortDate(calendarDate),
    calendarDate,
    programSlug: fallbackSlug,
  };
}