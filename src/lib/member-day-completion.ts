import type { MemberDaySummary } from "@/lib/member-day-window-types";

const CALENDAR_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A day is done if that workout was logged, or any session was logged on that calendar date. */
export function dayWorkoutCompleted(
  day: Pick<MemberDaySummary, "iso" | "calendarDate" | "workoutId">,
  loggedWorkoutIds: Set<string>,
  loggedCalendarDates: Set<string>,
): boolean {
  if (day.workoutId && loggedWorkoutIds.has(day.workoutId)) return true;
  if (day.calendarDate && loggedCalendarDates.has(day.calendarDate)) return true;
  if (CALENDAR_ISO.test(day.iso) && loggedCalendarDates.has(day.iso)) return true;
  return false;
}

export function markDaysCompleted(
  days: MemberDaySummary[],
  loggedWorkoutIds: Set<string>,
  loggedCalendarDates: Set<string>,
): MemberDaySummary[] {
  return days.map((day) => ({
    ...day,
    completed: dayWorkoutCompleted(day, loggedWorkoutIds, loggedCalendarDates),
  }));
}
