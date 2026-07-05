import type { PrescriptionDraft, PrescriptionExampleRow } from "@/lib/prescription-example-types";

function phaseLabel(
  type: string,
  durationSec: number | null,
  reps: number | null,
  repKind: string,
  positionCue: string,
): string | null {
  const t = type.trim().toLowerCase();
  if (!t) return null;
  if (t === "hold") {
    const cue = positionCue ? ` (${positionCue})` : "";
    return `${durationSec ?? "?"}s hold${cue}`;
  }
  if (t === "reps") {
    if (repKind === "max") return `max ${reps ?? "?"} reps`;
    return `${reps ?? "?"} reps`;
  }
  if (t === "burnout") return "burnout reps";
  if (t === "timed") return `${durationSec ?? "?"}s`;
  return null;
}

export function buildPrescriptionSummary(
  row: Pick<
    PrescriptionExampleRow,
    | "patternType"
    | "setCount"
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
  >,
): string {
  const p1 = phaseLabel(
    row.phase1Type,
    row.phase1DurationSec,
    row.phase1Reps,
    row.phase1RepKind,
    row.phase1PositionCue,
  );
  const p2 = phaseLabel(
    row.phase2Type,
    row.phase2DurationSec,
    row.phase2Reps,
    row.phase2RepKind,
    row.phase2PositionCue,
  );
  const inner = [p1, p2].filter(Boolean).join(" → ");

  if (row.patternType === "standard_reps" && row.phase1Reps) {
    return `${row.setCount} sets × ${row.phase1Reps} reps`;
  }
  if (row.patternType === "max_reps" && row.phase1Reps) {
    return `${row.setCount} sets × max ${row.phase1Reps} reps`;
  }

  const sets = row.setCount === 1 ? "1 set" : `${row.setCount} sets`;
  return inner ? `${sets}: ${inner}` : sets;
}

export function withSummary<T extends PrescriptionDraft>(draft: T): T & { summary: string } {
  return { ...draft, summary: buildPrescriptionSummary(draft as PrescriptionExampleRow) };
}