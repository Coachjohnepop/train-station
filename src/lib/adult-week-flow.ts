/**
 * Personal Adult week — Day 1 of a member's start date is always this sequence,
 * not the shared gym calendar.
 */
export const ADULT_WEEK_FASTED_CARDIO_ID = "adult-week-fasted-cardio";
export const ADULT_WEEK_ACTIVE_RECOVERY_ID = "adult-week-active-recovery-stretch";
export const ADULT_WEEK_REST_MEAL_PREP_ID = "adult-week-rest-meal-prep";

export type AdultWeekDayKind =
  | "upper-body"
  | "lower-body"
  | "fasted-cardio"
  | "active-recovery"
  | "rest-meal-prep";

export type AdultWeekFlowDay = {
  dayNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  kind: AdultWeekDayKind;
  title: string;
  /** Canonical catalog workout for days we own (3 / 6 / 7). */
  workoutId?: string;
};

export const ADULT_WEEK_FLOW: readonly AdultWeekFlowDay[] = [
  { dayNumber: 1, kind: "upper-body", title: "Upper Body" },
  { dayNumber: 2, kind: "lower-body", title: "Lower Body" },
  {
    dayNumber: 3,
    kind: "fasted-cardio",
    title: "Fasted Cardio",
    workoutId: ADULT_WEEK_FASTED_CARDIO_ID,
  },
  { dayNumber: 4, kind: "upper-body", title: "Upper Body" },
  { dayNumber: 5, kind: "lower-body", title: "Lower Body" },
  {
    dayNumber: 6,
    kind: "active-recovery",
    title: "Active Recovery Stretch",
    workoutId: ADULT_WEEK_ACTIVE_RECOVERY_ID,
  },
  {
    dayNumber: 7,
    kind: "rest-meal-prep",
    title: "Rest and Meal Prep",
    workoutId: ADULT_WEEK_REST_MEAL_PREP_ID,
  },
];

export function adultWeekFlowDay(dayNumber: number): AdultWeekFlowDay | null {
  return ADULT_WEEK_FLOW.find((d) => d.dayNumber === dayNumber) ?? null;
}
