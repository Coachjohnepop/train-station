import type { RollingCalendarDayPhase } from "@/lib/program-calendar";
import type { DayVisibilityTier } from "@/lib/workout-day-visibility";

export type MemberDaySummary = {
  iso: string;
  /** Calendar date for this block day (when member chose a start date). */
  calendarDate?: string;
  phase: RollingCalendarDayPhase;
  weekday: string;
  shortDate: string;
  dayLabel: string;
  /** W1D1 = 1 — member-facing program day from enrollment start. */
  enrollmentDayNumber?: number;
  weekNumber: number;
  dayNumber: number;
  workoutName: string | null;
  workoutId: string | null;
  programSlug: string;
  completed: boolean;
  exerciseCount: number;
  exerciseNames: string[];
  stretchNames: string[];
  smsOverride: boolean;
  hasWorkout: boolean;
  daysFromToday: number;
  visibilityTier: DayVisibilityTier;
  /** Theme-only label for far-future days (e.g. "Leg day"). */
  themeLabel: string | null;
};

export type MemberDayWindowRollup = {
  pastDone: number;
  pastTotal: number;
  futureTotal: number;
};