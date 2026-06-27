import type { RollingCalendarDayPhase } from "@/lib/program-calendar";

export type MemberDaySummary = {
  iso: string;
  phase: RollingCalendarDayPhase;
  weekday: string;
  shortDate: string;
  dayLabel: string;
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
};

export type MemberDayWindowRollup = {
  pastDone: number;
  pastTotal: number;
  futureTotal: number;
};