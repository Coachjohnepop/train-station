export const PRESCRIPTION_PATTERN_TYPES = [
  "standard_reps",
  "hold_burnout",
  "hold_fixed_reps",
  "timed_rounds",
  "burnout_only",
  "hold_only",
  "hold_then_timed",
  "max_reps",
] as const;

export type PrescriptionPatternType = (typeof PRESCRIPTION_PATTERN_TYPES)[number];

export const PATTERN_TYPE_LABELS: Record<PrescriptionPatternType, string> = {
  standard_reps: "Standard reps",
  hold_burnout: "Hold → burnout",
  hold_fixed_reps: "Hold → fixed reps",
  timed_rounds: "Timed rounds",
  burnout_only: "Burnout only",
  hold_only: "Hold only",
  hold_then_timed: "Hold → timed",
  max_reps: "Max reps",
};

export type PhaseTypeValue = "hold" | "reps" | "burnout" | "timed" | "";
export type RepKindValue = "fixed" | "burnout" | "max" | "";

export type PrescriptionExampleRow = {
  id: number;
  patternType: PrescriptionPatternType;
  sampleExercise: string;
  setCount: number;
  restBetweenSetsSec: number;
  weightTier: string;
  phase1Type: PhaseTypeValue;
  phase1DurationSec: number | null;
  phase1Reps: number | null;
  phase1RepKind: RepKindValue;
  phase1PositionCue: string;
  phase2Type: PhaseTypeValue;
  phase2DurationSec: number | null;
  phase2Reps: number | null;
  phase2RepKind: RepKindValue;
  phase2PositionCue: string;
  notes: string;
  summary: string;
};

export type PrescriptionDraft = Omit<PrescriptionExampleRow, "id" | "summary"> & {
  id?: number;
  summary?: string;
};