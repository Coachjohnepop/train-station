import {
  isDayOffLabel,
  isFastedCardioLabel,
  isGymLabel,
  isHomeLabel,
  isWorkoutDayLabel,
  normalizeDayOptions,
} from "@/lib/program-calendar";

export type ProgramDayLike = {
  id: string;
  dayNumber: number;
  workoutId?: string | null;
  publishedAt?: string | null;
  options?: Array<{ workoutId: string; label: string }>;
};

export type DayReadinessReason =
  | "complete"
  | "empty"
  | "missing-workout"
  | "needs-publish";

export type DayReadiness = {
  complete: boolean;
  reason: DayReadinessReason;
  label: string;
};

export function getDayOptions(day: ProgramDayLike): Array<{ workoutId: string; label: string }> {
  if (day.options && day.options.length > 0) {
    return normalizeDayOptions(day.options);
  }
  if (day.workoutId) return [{ workoutId: day.workoutId, label: "Gym" }];
  return [];
}

/** A day is coach-ready when published or fully planned (workouts assigned / day off / cardio). */
export function assessProgramDayReadiness(day: ProgramDayLike): DayReadiness {
  if (day.publishedAt) {
    return { complete: true, reason: "complete", label: "Published" };
  }

  const options = getDayOptions(day);
  if (options.length === 0) {
    return { complete: false, reason: "empty", label: "No workout assigned" };
  }

  if (options.some((o) => isDayOffLabel(o.label))) {
    return { complete: true, reason: "complete", label: "Day off" };
  }

  const fasted = options.find((o) => isFastedCardioLabel(o.label));
  if (fasted) {
    if (fasted.workoutId) {
      return { complete: true, reason: "complete", label: "Fasted cardio" };
    }
    return { complete: false, reason: "missing-workout", label: "Fasted cardio missing workout" };
  }

  const workoutOpts = options.filter(
    (o) => isGymLabel(o.label) || isHomeLabel(o.label) || isWorkoutDayLabel(o.label),
  );
  if (workoutOpts.length === 0) {
    return { complete: false, reason: "missing-workout", label: "Missing Gym/Home workout" };
  }

  if (!workoutOpts.every((o) => o.workoutId)) {
    return { complete: false, reason: "missing-workout", label: "Workout not fully assigned" };
  }

  return { complete: false, reason: "needs-publish", label: "Assigned — publish when final" };
}