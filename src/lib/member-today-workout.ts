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
import { resolveDemoUser } from "@/lib/demo-user-directory";

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

function memberDisplayName(userId: string, fallback = "Member"): string {
  return resolveDemoUser(userId)?.name || fallback;
}

/** Resolve the workout to show on /member/today for a member + calendar date. */
export async function resolveTodayPageWorkout(
  userId: string,
  viewDate: string,
  nameFallback = "Member",
): Promise<TodayPageWorkout> {
  await Promise.all([
    hydrateTodaySessions({ preferFresh: true }),
    hydrateSmsWorkouts(),
  ]);

  const memberName = memberDisplayName(userId, nameFallback);
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
      scheduleLabel: `${program.name} · Week ${resolved.weekNumber} · Day ${resolved.dayNumber}${resolved.option ? ` · ${resolved.option}` : ""}`,
    };
  }

  return {
    session,
    workout: null,
    programSlug: session?.programSlug || enrollmentSlugsForUser(userId)[0] || "adult",
    source: null,
  };
}

export function todayTargetSummary(target: GoToTodayTarget): string {
  if (target.kind === "sms") return target.title;
  if (target.kind === "program") return target.title;
  return "No workout on today's calendar";
}