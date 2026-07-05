import type { PrescriptionExampleRow } from "@/lib/prescription-example-types";
import { inferPrescriptionFromLegacy } from "@/lib/workout-prescription-backfill";
import type { SetApproachId } from "@/lib/workout-schemes";

type LegacyItem = {
  setScheme: string | null;
  reps: string | null;
  sets: number | null;
  restSec?: number | null;
  notes: string | null;
  exercise?: { name?: string };
};

function patternFromBackfill(pattern: string): PrescriptionExampleRow["patternType"] {
  const allowed: PrescriptionExampleRow["patternType"][] = [
    "standard_reps",
    "hold_burnout",
    "hold_fixed_reps",
    "timed_rounds",
    "burnout_only",
    "hold_only",
    "hold_then_timed",
    "max_reps",
  ];
  return allowed.includes(pattern as PrescriptionExampleRow["patternType"])
    ? (pattern as PrescriptionExampleRow["patternType"])
    : "standard_reps";
}

export function legacyWorkoutItemToPrescriptionDraft(
  item: LegacyItem,
  exerciseName?: string,
): Omit<PrescriptionExampleRow, "id" | "summary"> {
  const backfill = inferPrescriptionFromLegacy(
    {
      sets: item.sets,
      reps: item.reps,
      restSec: item.restSec ?? null,
      notes: item.notes,
      setScheme: item.setScheme,
      exerciseName: exerciseName ?? item.exercise?.name ?? null,
    },
    { defaultRestBetweenSetsSec: item.restSec ?? 90 },
  );

  const patternType = backfill ? patternFromBackfill(backfill.pattern) : "standard_reps";
  const rx = backfill?.prescription;
  const p1 = rx?.phases[0];
  const p2 = rx?.phases[1];

  const phaseType = (t?: string) => {
    const v = (t ?? "").toLowerCase();
    if (v === "hold" || v === "reps" || v === "burnout" || v === "timed") return v;
    return "" as const;
  };

  const repKind = (k?: string) => {
    const v = (k ?? "").toLowerCase();
    if (v === "fixed" || v === "burnout" || v === "max") return v;
    return "" as const;
  };

  let weightTier = "medium";
  if (item.setScheme === "standard" && item.reps) {
    const n = Number(item.reps);
    if (n <= 8) weightTier = "heavy";
  }

  return {
    patternType,
    sampleExercise: exerciseName ?? item.exercise?.name ?? "Exercise",
    setCount: rx?.setCount ?? item.sets ?? 1,
    restBetweenSetsSec: rx?.restBetweenSetsSec ?? item.restSec ?? 90,
    weightTier,
    phase1Type: phaseType(p1?.phaseType),
    phase1DurationSec: p1?.durationSec ?? null,
    phase1Reps: p1?.reps ?? null,
    phase1RepKind: repKind(p1?.repKind),
    phase1PositionCue: p1?.positionCue ?? "",
    phase2Type: phaseType(p2?.phaseType),
    phase2DurationSec: p2?.durationSec ?? null,
    phase2Reps: p2?.reps ?? null,
    phase2RepKind: repKind(p2?.repKind),
    phase2PositionCue: p2?.positionCue ?? "",
    notes: rx?.notes ?? item.notes ?? "",
  };
}

export function legacySetSchemeHint(setScheme: string | null): SetApproachId | null {
  if (!setScheme) return null;
  const allowed: SetApproachId[] = [
    "standard",
    "drop_sets",
    "rest_pause",
    "positive",
    "negative",
    "timed",
  ];
  return allowed.includes(setScheme as SetApproachId) ? (setScheme as SetApproachId) : null;
}