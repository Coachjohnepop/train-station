import type { MemberDaySummary } from "@/lib/member-day-window-types";
import { addDaysIso } from "@/lib/workout-day-visibility";

const CALENDAR_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDateForDay(
  day: Pick<MemberDaySummary, "iso" | "calendarDate" | "daysFromToday">,
  calendarToday?: string,
): string | null {
  if (day.calendarDate && CALENDAR_ISO.test(day.calendarDate)) return day.calendarDate;
  if (CALENDAR_ISO.test(day.iso)) return day.iso;
  if (calendarToday && typeof day.daysFromToday === "number") {
    return addDaysIso(calendarToday, day.daysFromToday);
  }
  return null;
}

/** A day is done if that workout was logged, or any session was logged on that calendar date. */
export function dayWorkoutCompleted(
  day: Pick<MemberDaySummary, "iso" | "calendarDate" | "workoutId" | "daysFromToday">,
  loggedWorkoutIds: Set<string>,
  loggedCalendarDates: Set<string>,
  calendarToday?: string,
): boolean {
  if (day.workoutId && loggedWorkoutIds.has(day.workoutId)) return true;
  const date = calendarDateForDay(day, calendarToday);
  if (date && loggedCalendarDates.has(date)) return true;
  return false;
}

export function markDaysCompleted(
  days: MemberDaySummary[],
  loggedWorkoutIds: Set<string>,
  loggedCalendarDates: Set<string>,
  calendarToday?: string,
): MemberDaySummary[] {
  return days.map((day) => {
    const calendarDate = calendarDateForDay(day, calendarToday) ?? day.calendarDate;
    return {
      ...day,
      calendarDate: calendarDate ?? day.calendarDate,
      completed: dayWorkoutCompleted(
        { ...day, calendarDate: calendarDate ?? undefined },
        loggedWorkoutIds,
        loggedCalendarDates,
        calendarToday,
      ),
    };
  });
}
