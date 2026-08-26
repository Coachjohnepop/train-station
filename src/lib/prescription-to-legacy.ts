import type { PrescriptionExampleRow } from "@/lib/prescription-example-types";
import type { SetApproachId, WeightTierId } from "@/lib/workout-schemes";

export type LegacyWorkoutPrescription = {
  setScheme: SetApproachId;
  repPattern: string | null;
  reps: string | null;
  sets: number;
  weightTier: WeightTierId;
  restSec: number | null;
  notes: string | null;
};

function tier(v: string): WeightTierId {
  if (v === "light" || v === "heavy") return v;
  return "medium";
}

function holdNote(
  row: Pick<PrescriptionExampleRow, "phase1DurationSec" | "phase1PositionCue">,
): string {
  const cue = row.phase1PositionCue ? ` (${row.phase1PositionCue})` : "";
  return `${row.phase1DurationSec ?? "?"}s hold${cue}`;
}

export function prescriptionToLegacy(
  row: Pick<
    PrescriptionExampleRow,
    | "patternType"
    | "setCount"
    | "restBetweenSetsSec"
    | "weightTier"
    | "phase1Type"
    | "phase1DurationSec"
    | "phase1Reps"
    | "phase1RepKind"
    | "phase1PositionCue"
    | "phase2Type"
    | "phase2DurationSec"
    | "phase2Reps"
    | "phase2RepKind"
    | "phase2PositionCue"
    | "notes"
  >,
): LegacyWorkoutPrescription {
  const base = {
    sets: row.setCount,
    weightTier: tier(row.weightTier),
    restSec: row.restBetweenSetsSec,
  };

  switch (row.patternType) {
    case "standard_reps":
      return {
        ...base,
        setScheme: "standard",
        repPattern: null,
        reps: row.phase1Reps != null ? String(row.phase1Reps) : null,
        notes: row.notes || null,
      };
    case "max_reps":
      return {
        ...base,
        setScheme: "standard",
        repPattern: null,
        reps: row.phase1Reps != null ? `max ${row.phase1Reps}` : "max",
        notes: row.notes || null,
      };
    case "hold_burnout":
      return {
        ...base,
        setScheme: "negative",
        repPattern: null,
        reps: "burnout",
        notes: [holdNote(row), "burnout reps", row.notes].filter(Boolean).join(" · ") || null,
      };
    case "hold_fixed_reps":
      return {
        ...base,
        setScheme: "negative",
        repPattern: null,
        reps: row.phase2Reps != null ? String(row.phase2Reps) : null,
        notes:
          [holdNote(row), row.phase2Reps != null ? `then ${row.phase2Reps} reps` : null, row.notes]
            .filter(Boolean)
            .join(" · ") || null,
      };
    case "timed_rounds":
      return {
        ...base,
        setScheme: "timed",
        repPattern: null,
        reps: row.phase1DurationSec != null ? `${row.phase1DurationSec}s on` : null,
        notes: row.notes || null,
      };
    case "hit_intervals": {
      const work = row.phase1DurationSec ?? 20;
      const rest = row.phase2DurationSec ?? row.restBetweenSetsSec ?? work;
      return {
        ...base,
        setScheme: "hit",
        repPattern: null,
        reps: work === rest ? `${work}s` : `${work}/${rest}`,
        restSec: rest,
        notes: row.notes || null,
      };
    }
    case "burnout_only":
      return {
        ...base,
        setScheme: "negative",
        repPattern: null,
        reps: "burnout",
        notes: row.notes || "burnout reps",
      };
    case "hold_only":
      return {
        ...base,
        setScheme: "rest_pause",
        repPattern: null,
        reps: row.phase1DurationSec != null ? `${row.phase1DurationSec}s` : null,
        notes: [holdNote(row), row.notes].filter(Boolean).join(" · ") || null,
      };
    case "hold_then_timed":
      return {
        ...base,
        setScheme: "timed",
        repPattern: null,
        reps:
          row.phase2DurationSec != null
            ? `${row.phase2DurationSec}s on`
            : row.phase1DurationSec != null
              ? `${row.phase1DurationSec}s hold`
              : null,
        notes:
          [
            row.phase1DurationSec ? holdNote(row) : null,
            row.phase2DurationSec ? `${row.phase2DurationSec}s timed` : null,
            row.notes,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      };
    default:
      return {
        ...base,
        setScheme: "standard",
        repPattern: null,
        reps: row.phase1Reps != null ? String(row.phase1Reps) : null,
        notes: row.notes || null,
      };
  }
}