import { loadLoggedCalendarDates, loadLoggedWorkoutIds } from "@/lib/workout-logs-store";

export async function loadMemberLoggedWorkoutIds(uid: string): Promise<Set<string>> {
  return loadLoggedWorkoutIds(uid);
}

export async function loadMemberLoggedCalendarDates(uid: string): Promise<Set<string>> {
  return loadLoggedCalendarDates(uid);
}

export function hasAssignedWorkout(day: {
  workout?: unknown;
  options?: unknown[];
}): boolean {
  return !!(day.workout || (day.options && day.options.length > 0));
}

export function computeScheduleProgress(
  program: { weeks: Array<{ weekNumber: number; days: Array<{ dayNumber?: number; options?: Array<{ workoutId: string }>; workoutId?: string }> }> },
  curWeek: number,
  curDay: number,
  loggedSet: Set<string>,
  isWorkout: boolean,
) {
  const allDays = program.weeks.flatMap((w) => w.days);
  const assignedDays = isWorkout ? allDays.filter(hasAssignedWorkout) : allDays;
  const totalAssigned = assignedDays.length;

  let completedCount = 0;
  program.weeks.forEach((w) => {
    (w.days || []).forEach((d) => {
      if (isWorkout && !hasAssignedWorkout(d)) return;
      const hasLoggedOption =
        (d.options || []).some((o) => loggedSet.has(o.workoutId)) ||
        (d.workoutId && loggedSet.has(d.workoutId));
      if (hasLoggedOption) completedCount++;
    });
  });

  return { totalAssigned, completedCount, assignedDays };
}