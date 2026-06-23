import "server-only";

import { getUserEnrollments } from "@/lib/data/user-data";
import { getProgramBySlug } from "@/lib/program-data";
import { normalizeProgramSlug } from "@/lib/programs";
import { resolveUserId } from "@/lib/current-user";

export type ResolvedProgramWorkout = {
  workoutId: string;
  option?: string;
  weekNumber: number;
  dayNumber: number;
  workoutName?: string;
};

export function dayWorkoutOptions(day: {
  workoutId?: string | null;
  workout?: { id: string; name?: string } | null;
  options?: Array<{ workoutId: string; label?: string; workout?: { id: string; name?: string } | null }>;
}) {
  if (day.options?.length) return day.options;
  if (day.workoutId) {
    return [{ workoutId: day.workoutId, label: "Gym", workout: day.workout }];
  }
  if (day.workout?.id) {
    return [{ workoutId: day.workout.id, label: "Gym", workout: day.workout }];
  }
  return [];
}

/** Resolve the member's current scheduled workout for a program (enrollment week/day). */
export async function resolveMemberProgramWorkout(
  programSlug: string,
  userId?: string,
): Promise<ResolvedProgramWorkout | null> {
  const slug = normalizeProgramSlug(programSlug);
  const program = await getProgramBySlug(slug);
  if (!program?.weeks?.length) return null;

  const uid = userId || (await resolveUserId());
  const enrolls = getUserEnrollments(uid);
  const en = enrolls[slug] || enrolls[programSlug] || { currentWeek: 1, currentDay: 1 };

  const week =
    program.weeks.find((w: { weekNumber: number }) => w.weekNumber === en.currentWeek) ||
    program.weeks[0];
  const day =
    week?.days?.find((d: { dayNumber: number }) => d.dayNumber === en.currentDay) ||
    week?.days?.[0];
  if (!day) return null;

  const opts = dayWorkoutOptions(day);
  if (!opts.length) return null;

  const pick = opts.find((o) => /gym/i.test(o.label || "")) || opts[0];
  if (!pick?.workoutId) return null;

  return {
    workoutId: pick.workoutId,
    option: pick.label,
    weekNumber: week.weekNumber,
    dayNumber: day.dayNumber,
    workoutName: pick.workout?.name || day.workout?.name,
  };
}

export async function memberProgramWorkoutPath(
  programSlug: string,
  userId?: string,
): Promise<string> {
  const resolved = await resolveMemberProgramWorkout(programSlug, userId);
  if (!resolved) {
    return `/member/programs/${normalizeProgramSlug(programSlug)}`;
  }
  const params = new URLSearchParams({
    program: normalizeProgramSlug(programSlug),
    workoutId: resolved.workoutId,
  });
  if (resolved.option) params.set("option", resolved.option);
  return `/member/workout?${params.toString()}`;
}