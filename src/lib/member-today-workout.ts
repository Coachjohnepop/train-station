import "server-only";

import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { getProgramBySlug } from "@/lib/program-data";
import {
  resolveProgramWorkoutForCalendarDate,
  type GoToTodayTarget,
} from "@/lib/go-to-today";
import { getMemberWorkoutById } from "@/lib/member-workout";
import { getUserEnrollments } from "@/lib/data/user-data";
import { getSmsGeneratedWorkout, hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import {
  getSessionForUserOnDate,
  hydrateTodaySessions,
  type TodaySession,
} from "@/lib/today-sessions";
import { resolveCoachMemberName } from "@/lib/coach-roster";
import { parseEnrollmentDayKey } from "@/lib/member-enrollment-day";
import { dayWorkoutOptions } from "@/lib/member-program-workout";
import { memberScheduleLabel } from "@/lib/member-day-window";
import { localTodayIso } from "@/lib/program-calendar";

export type TodayWorkoutSource = "sms" | "program" | null;

export type TodayPageWorkout = {
  session: TodaySession | null;
  workout: MemberWorkoutView | null;
  programSlug: string;
  source: TodayWorkoutSource;
  scheduleLabel?: string;
};

function enrollmentSlugsForUser(userId: string): string[] {
  const enrolls = getUserEnrollments(userId);
  const slugs = Object.keys(enrolls);
  return slugs.sort((a, b) => {
    if (a === "adult") return -1;
    if (b === "adult") return 1;
    return a.localeCompare(b);
  });
}

function isCalendarIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function resolveEnrollmentProgramWorkout(
  userId: string,
  memberName: string,
  slug: string,
  weekNumber: number,
  dayNumber: number,
  session: TodaySession | null,
): Promise<TodayPageWorkout | null> {
  const program = await getProgramBySlug(slug);
  if (!program) return null;

  const enrolls = getUserEnrollments(userId);
  const enrollment = enrolls[slug] || { currentWeek: 1, currentDay: 1 };
  const isProgramToday =
    weekNumber === enrollment.currentWeek && dayNumber === enrollment.currentDay;

  if (isProgramToday) {
    const calendarToday = localTodayIso();
    const coachSession = getSessionForUserOnDate(userId, calendarToday);
    if (coachSession?.workoutId) {
      const workout = await getSmsGeneratedWorkout(coachSession.workoutId, memberName, userId);
      if (workout) {
        return {
          session: coachSession,
          workout,
          programSlug: coachSession.programSlug || slug,
          source: "sms",
          scheduleLabel: coachSession.title,
        };
      }
    }
  }

  const week = program.weeks.find((w: { weekNumber: number }) => w.weekNumber === weekNumber);
  const day = week?.days.find((d: { dayNumber: number }) => d.dayNumber === dayNumber);
  if (!day) return null;

  const opts = dayWorkoutOptions(day);
  const pick = opts.find((o) => /gym/i.test(o.label || "")) || opts[0];
  if (!pick?.workoutId) return null;

  const workout = await getMemberWorkoutById(pick.workoutId, {
    userId,
    memberName,
  });
  if (!workout) return null;

  return {
    session,
    workout,
    programSlug: slug,
    source: "program",
    scheduleLabel: memberScheduleLabel(program.name, weekNumber, dayNumber),
  };
}

/** Resolve the workout to show on /member/today (enrollment day key or calendar date). */
export async function resolveTodayPageWorkout(
  userId: string,
  viewDate: string,
  nameFallback = "Member",
): Promise<TodayPageWorkout> {
  await Promise.all([
    hydrateTodaySessions({ preferFresh: true }),
    hydrateSmsWorkouts(),
  ]);

  const memberName = await resolveCoachMemberName(userId, nameFallback);
  const enrollmentCoord = parseEnrollmentDayKey(viewDate);

  if (enrollmentCoord) {
    for (const slug of enrollmentSlugsForUser(userId)) {
      const program = await getProgramBySlug(slug);
      if (!program) continue;
      const cat = (program.category || "workout") as string;
      if (cat !== "workout" && cat !== "journey" && cat !== "yoga") continue;

      const resolved = await resolveEnrollmentProgramWorkout(
        userId,
        memberName,
        slug,
        enrollmentCoord.weekNumber,
        enrollmentCoord.dayNumber,
        null,
      );
      if (resolved) return resolved;
    }
  }

  if (isCalendarIso(viewDate)) {
    const session = getSessionForUserOnDate(userId, viewDate);

    if (session?.workoutId) {
      const workout = await getSmsGeneratedWorkout(session.workoutId, memberName, userId);
      if (workout) {
        return {
          session,
          workout,
          programSlug: session.programSlug || "adult",
          source: "sms",
          scheduleLabel: session.title,
        };
      }
    }

    for (const slug of enrollmentSlugsForUser(userId)) {
      const program = await getProgramBySlug(slug);
      if (!program) continue;
      const cat = (program.category || "workout") as string;
      if (cat !== "workout" && cat !== "journey" && cat !== "yoga") continue;

      const resolved = resolveProgramWorkoutForCalendarDate(program, viewDate);
      if (!resolved || resolved.smsOverride || !resolved.workoutId) continue;

      const workout = await getMemberWorkoutById(resolved.workoutId, {
        userId,
        memberName,
      });
      if (!workout) continue;

      return {
        session,
        workout,
        programSlug: slug,
        source: "program",
        scheduleLabel: memberScheduleLabel(program.name, resolved.weekNumber, resolved.dayNumber),
      };
    }

    return {
      session,
      workout: null,
      programSlug: session?.programSlug || enrollmentSlugsForUser(userId)[0] || "adult",
      source: null,
    };
  }

  const primarySlug = enrollmentSlugsForUser(userId)[0] || "adult";
  const enrolls = getUserEnrollments(userId);
  const enrollment = enrolls[primarySlug] || { currentWeek: 1, currentDay: 1 };

  const resolved = await resolveEnrollmentProgramWorkout(
    userId,
    memberName,
    primarySlug,
    enrollment.currentWeek,
    enrollment.currentDay,
    null,
  );

  if (resolved) return resolved;

  return {
    session: null,
    workout: null,
    programSlug: primarySlug,
    source: null,
  };
}

export function todayTargetSummary(target: GoToTodayTarget): string {
  if (target.kind === "sms") return target.title;
  if (target.kind === "program") return target.title;
  return "No workout on today's calendar";
}