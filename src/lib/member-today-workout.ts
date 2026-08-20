import "server-only";

import type { MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import { getProgramBySlug } from "@/lib/program-data";
import { type GoToTodayTarget } from "@/lib/go-to-today";
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
import {
  resolveDayPartsForEnrollment,
  resolveDayWorkoutForEnrollment,
} from "@/lib/member-program-workout";
import type { ResolvedDayPart } from "@/lib/program-day-sessions";
import { memberScheduleLabel } from "@/lib/member-day-window";
import { localTodayIso } from "@/lib/program-calendar";
import {
  personalCoordinateForCalendarDate,
  resolveProgramBlock,
} from "@/lib/member-program-block";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";

export type TodayWorkoutSource = "sms" | "program" | null;

export type TodayPageWorkout = {
  session: TodaySession | null;
  workout: MemberWorkoutView | null;
  programSlug: string;
  source: TodayWorkoutSource;
  scheduleLabel?: string;
  /** Multi-part day sessions (AM/mid/PM). Length 0–1 means single-workout UI. */
  parts?: ResolvedDayPart[];
  activePartIndex?: number;
};

async function enrollmentSlugsForUser(userId: string): Promise<string[]> {
  const enrolls = await getUserEnrollments(userId);
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
  preferredPartIndex?: number,
): Promise<TodayPageWorkout | null> {
  const program = await getProgramBySlug(slug);
  if (!program) return null;

  const enrolls = await getUserEnrollments(userId);
  const enrollment = enrolls[slug] || {
    currentWeek: 1,
    currentDay: 1,
    currentPhase: 1,
    trainingLocation: "gym" as const,
  };
  const startSettings = programStartSettingsFromCoach(await getCoachSettings());
  const block = resolveProgramBlock(
    enrollment,
    localTodayIso(),
    program.durationWeeks,
    startSettings.blockDays,
  );
  if (block.status === "pending" || block.status === "expired") return null;

  const effectiveEnrollment = {
    ...enrollment,
    currentWeek: block.weekNumber,
    currentDay: block.dayNumber,
  };
  const isProgramToday =
    weekNumber === effectiveEnrollment.currentWeek &&
    dayNumber === effectiveEnrollment.currentDay;

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

  const multi = resolveDayPartsForEnrollment(
    program,
    slug,
    effectiveEnrollment,
    dayNumber,
    weekNumber,
  );
  const parts = multi?.parts ?? [];
  if (!parts.length) {
    const resolved = resolveDayWorkoutForEnrollment(
      program,
      slug,
      effectiveEnrollment,
      dayNumber,
      weekNumber,
    );
    if (!resolved?.workoutId) return null;
    const workout = await getMemberWorkoutById(resolved.workoutId, {
      userId,
      memberName,
    });
    if (!workout) return null;
    return {
      session,
      workout,
      programSlug: slug,
      source: "program",
      scheduleLabel: memberScheduleLabel(
        program.name,
        resolved.phaseWeekNumber ?? weekNumber,
        dayNumber,
      ),
      parts: [
        {
          sessionId: "main",
          partIndex: 1,
          label: "Main",
          workoutId: resolved.workoutId,
          workoutName: resolved.workoutName,
          optionLabel: resolved.option,
        },
      ],
      activePartIndex: 1,
    };
  }

  const want =
    preferredPartIndex && parts.some((p) => p.partIndex === preferredPartIndex)
      ? preferredPartIndex
      : parts[0].partIndex;
  const active = parts.find((p) => p.partIndex === want) || parts[0];

  const workout = await getMemberWorkoutById(active.workoutId, {
    userId,
    memberName,
  });
  if (!workout) return null;

  return {
    session,
    workout,
    programSlug: slug,
    source: "program",
    scheduleLabel: memberScheduleLabel(program.name, multi!.weekNumber, dayNumber),
    parts: parts.length > 1 ? parts : parts,
    activePartIndex: active.partIndex,
  };
}

/** Resolve the workout to show on /member/today (enrollment day key or calendar date). */
export async function resolveTodayPageWorkout(
  userId: string,
  viewDate: string,
  nameFallback = "Member",
  opts?: { partIndex?: number },
): Promise<TodayPageWorkout> {
  await Promise.all([
    hydrateTodaySessions({ preferFresh: true }),
    hydrateSmsWorkouts(),
  ]);

  const memberName = await resolveCoachMemberName(userId, nameFallback);
  const enrollmentCoord = parseEnrollmentDayKey(viewDate);

  if (enrollmentCoord) {
    for (const slug of await enrollmentSlugsForUser(userId)) {
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
        opts?.partIndex,
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

    const enrolls = await getUserEnrollments(userId);
    const startSettings = programStartSettingsFromCoach(await getCoachSettings());

    for (const slug of await enrollmentSlugsForUser(userId)) {
      const program = await getProgramBySlug(slug);
      if (!program) continue;
      const cat = (program.category || "workout") as string;
      if (cat !== "workout" && cat !== "journey" && cat !== "yoga") continue;

      const enrollment = enrolls[slug];
      const personal = personalCoordinateForCalendarDate(
        enrollment?.programStartDate || viewDate,
        viewDate,
        program.durationWeeks,
        startSettings.blockDays,
      );
      if (personal) {
        const resolved = await resolveEnrollmentProgramWorkout(
          userId,
          memberName,
          slug,
          personal.weekNumber,
          personal.dayNumber,
          session,
          opts?.partIndex,
        );
        if (resolved) return resolved;
      }
      continue;
    }

    return {
      session,
      workout: null,
      programSlug: session?.programSlug || (await enrollmentSlugsForUser(userId))[0] || "adult",
      source: null,
    };
  }

  const slugs = await enrollmentSlugsForUser(userId);
  const primarySlug = slugs[0] || "adult";
  const enrolls = await getUserEnrollments(userId);
  const enrollment = enrolls[primarySlug] || { currentWeek: 1, currentDay: 1 };

  const resolved = await resolveEnrollmentProgramWorkout(
    userId,
    memberName,
    primarySlug,
    enrollment.currentWeek,
    enrollment.currentDay,
    null,
    opts?.partIndex,
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