import { DEFAULT_REST_TIMER_SECONDS } from "@/lib/rest-timer";

export type DayPrescription = {
  defaultSets: number;
  defaultReps: string;
  defaultRestSec: number;
};

export const DEFAULT_DAY_PRESCRIPTION: DayPrescription = {
  defaultSets: 3,
  defaultReps: "8-10",
  defaultRestSec: DEFAULT_REST_TIMER_SECONDS,
};

export function readDayPrescription(day: {
  defaultSets?: number | null;
  defaultReps?: string | null;
  defaultRestSec?: number | null;
}): DayPrescription {
  return {
    defaultSets: day.defaultSets ?? DEFAULT_DAY_PRESCRIPTION.defaultSets,
    defaultReps: day.defaultReps ?? DEFAULT_DAY_PRESCRIPTION.defaultReps,
    defaultRestSec: day.defaultRestSec ?? DEFAULT_DAY_PRESCRIPTION.defaultRestSec,
  };
}