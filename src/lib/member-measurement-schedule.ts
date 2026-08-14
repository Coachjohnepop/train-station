import { localTodayIso } from "@/lib/program-calendar";
import { addDaysIso } from "@/lib/workout-day-visibility";

/** Recurring tape check-in after the first post-interview sheet. */
export const MEASUREMENT_CYCLE_DAYS = 28;

export type MeasurementDayKind = "none" | "first_due" | "today" | "tomorrow";

export type MeasurementDayState = {
  kind: MeasurementDayKind;
  dueIso: string | null;
  lastMeasuredIso: string | null;
};

export function isoDateFromTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return localTodayIso(d);
}

export function nextMeasurementDueIso(lastMeasuredIso: string): string {
  return addDaysIso(lastMeasuredIso, MEASUREMENT_CYCLE_DAYS);
}

export function resolveMeasurementDay(input: {
  intakeComplete: boolean;
  lastMeasuredIso: string | null;
  todayIso?: string;
}): MeasurementDayState {
  const todayIso = input.todayIso || localTodayIso();
  if (!input.intakeComplete) {
    return { kind: "none", dueIso: null, lastMeasuredIso: input.lastMeasuredIso };
  }
  if (!input.lastMeasuredIso) {
    return { kind: "first_due", dueIso: todayIso, lastMeasuredIso: null };
  }
  const dueIso = nextMeasurementDueIso(input.lastMeasuredIso);
  if (dueIso === todayIso) {
    return { kind: "today", dueIso, lastMeasuredIso: input.lastMeasuredIso };
  }
  const tomorrowIso = addDaysIso(todayIso, 1);
  if (dueIso === tomorrowIso) {
    return { kind: "tomorrow", dueIso, lastMeasuredIso: input.lastMeasuredIso };
  }
  return { kind: "none", dueIso, lastMeasuredIso: input.lastMeasuredIso };
}

export function memberNeedsFirstTapeMeasurements(input: {
  onboardingComplete?: boolean | null;
  coachIntakeCompleteAt?: string | null;
  hasCheckIn: boolean;
}): boolean {
  return Boolean(input.onboardingComplete && input.coachIntakeCompleteAt && !input.hasCheckIn);
}
