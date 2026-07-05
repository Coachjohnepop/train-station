/**
 * Structured workout prescriptions — exercise name in catalog;
 * sets, reps, holds, rest live on WorkoutExercise + WorkoutSetPhase.
 */

import { MAX_REPS_PER_SET, MAX_SET_COUNT } from "@/lib/workout-schemes";

export const SET_PHASE_TYPES = ["HOLD", "REPS", "BURNOUT", "TIMED"] as const;
export type SetPhaseType = (typeof SET_PHASE_TYPES)[number];

export const REP_KINDS = ["FIXED", "BURNOUT", "MAX"] as const;
export type RepKind = (typeof REP_KINDS)[number];

export type WorkoutSetPhaseInput = {
  phaseIndex: number;
  phaseType: SetPhaseType;
  durationSec?: number | null;
  reps?: number | null;
  repKind?: RepKind;
  positionCue?: string | null;
};

export type WorkoutExercisePrescriptionInput = {
  setCount: number;
  restBetweenSetsSec?: number | null;
  weightTier?: string | null;
  notes?: string | null;
  phases: WorkoutSetPhaseInput[];
};

export { MAX_REPS_PER_SET, MAX_SET_COUNT };

export function clampSetCount(n: number): number {
  return Math.min(MAX_SET_COUNT, Math.max(1, Math.round(n)));
}

export function clampReps(n: number): number {
  return Math.min(MAX_REPS_PER_SET, Math.max(1, Math.round(n)));
}

export function formatPhaseSummary(phase: WorkoutSetPhaseInput): string {
  switch (phase.phaseType) {
    case "HOLD": {
      const cue = phase.positionCue ? ` (${phase.positionCue})` : "";
      return `${phase.durationSec ?? "?"}s hold${cue}`;
    }
    case "REPS":
      if (phase.repKind === "MAX") {
        return `max ${phase.reps ?? MAX_REPS_PER_SET} reps`;
      }
      return `${phase.reps ?? "?"} reps`;
    case "BURNOUT":
      return "burnout reps";
    case "TIMED":
      return `${phase.durationSec ?? "?"}s`;
    default:
      return phase.phaseType;
  }
}

export function formatPrescriptionPhases(
  prescription: Pick<WorkoutExercisePrescriptionInput, "setCount" | "phases">,
): string {
  const inner = prescription.phases
    .sort((a, b) => a.phaseIndex - b.phaseIndex)
    .map(formatPhaseSummary)
    .join(" → ");
  const sets =
    prescription.setCount === 1
      ? "1 set"
      : `${prescription.setCount} sets`;
  return inner ? `${sets}: ${inner}` : sets;
}