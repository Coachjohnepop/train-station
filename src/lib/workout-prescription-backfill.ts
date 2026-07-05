/**
 * Infer structured WorkoutSetPhase rows from legacy flat WorkoutExercise fields.
 */

import {
  clampReps,
  clampSetCount,
  formatPrescriptionPhases,
  type WorkoutExercisePrescriptionInput,
  type WorkoutSetPhaseInput,
} from "./workout-prescription";

export type LegacyWorkoutExerciseRow = {
  sets: number | null;
  reps: string | null;
  restSec: number | null;
  notes: string | null;
  setScheme: string | null;
  exerciseName?: string | null;
};

function prescriptionBlob(row: LegacyWorkoutExerciseRow): string {
  return normalizeText(
    [row.exerciseName, row.notes, row.reps].filter(Boolean).join(" "),
  );
}

export type BackfillResult = {
  prescription: WorkoutExercisePrescriptionInput;
  cleanedNotes: string | null;
  pattern: string;
  summary: string;
};

const DEFAULT_REST_SEC = 90;

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Parse M:SS or "1:30 min" style rest from free text. */
export function parseRestSecFromText(text: string): number | null {
  const minSec = text.match(/(\d+)\s*:\s*(\d{1,2})\s*(?:min)?/i);
  if (minSec) {
    return Number(minSec[1]) * 60 + Number(minSec[2]);
  }
  const mins = text.match(/(\d+)\s*min(?:ute)?s?/i);
  if (mins) return Number(mins[1]) * 60;
  return null;
}

function cleanLegacyNotes(notes: string | null): string | null {
  if (!notes) return null;
  const parts = notes
    .split(/\s*·\s*|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^from:/i.test(p))
    .filter((p) => !/^\d+\s*sec\s*hold/i.test(p))
    .filter((p) => !/^hold at/i.test(p))
    .filter((p) => !/^then\b/i.test(p))
    .filter((p) => !/burn\s*out|burnout/i.test(p))
    .filter((p) => !/^rest periods/i.test(p));
  return parts.length ? parts.join(" · ") : null;
}

function extractHoldSec(text: string): number | null {
  const patterns = [
    /(\d+)\s*sec(?:ond)?s?\s*hold/i,
    /hold(?:\s+at[^·\n]{0,40})?\s+(\d+)\s*sec/i,
    /(\d+)\s*sec(?:ond)?s?(?:\s+hold)?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractPositionCue(text: string): string | null {
  const cues = [
    /bottom of (?:the )?lift/i,
    /top of (?:the )?squeeze/i,
    /bottom of squat/i,
    /peak contraction/i,
    /mid range/i,
    /at bottom/i,
    /at top/i,
  ];
  for (const re of cues) {
    const m = text.match(re);
    if (m) return m[0].toLowerCase();
  }
  return null;
}

function extractFixedRepsAfterHold(text: string): number | null {
  const m = text.match(/then\s+(\d+)\s+reps?/i);
  if (m) return clampReps(Number(m[1]));
  return null;
}

function isBurnoutText(text: string): boolean {
  return /burn\s*-?\s*out|burnout/i.test(text);
}

function parseNumericReps(reps: string | null): number | null {
  if (!reps || reps === "—" || reps === "-") return null;
  if (/burnout/i.test(reps)) return null;
  const single = reps.match(/^(\d+)$/);
  if (single) return clampReps(Number(single[1]));
  const comma = reps.match(/^(\d+)(?:\s*,\s*\d+)+$/);
  if (comma) return clampReps(Number(comma[1]));
  return null;
}

function parseCommaSetCount(reps: string | null): number | null {
  if (!reps?.includes(",")) return null;
  const nums = reps.split(/\s*,\s*/).filter(Boolean);
  return nums.length >= 1 ? clampSetCount(nums.length) : null;
}

function parseTimedSec(reps: string | null, notes: string | null): number | null {
  const blob = `${reps ?? ""} ${notes ?? ""}`;
  const on = blob.match(/(\d+)\s*s\s*on/i);
  if (on) return Number(on[1]);
  const rounds = blob.match(/(\d+)\s*rounds?\s*(?:on\s*)?(\d+)\s*sec/i);
  if (rounds) return Number(rounds[2]);
  return null;
}

function pushPhase(phases: WorkoutSetPhaseInput[], phase: Omit<WorkoutSetPhaseInput, "phaseIndex">) {
  phases.push({ ...phase, phaseIndex: phases.length + 1 });
}

export function inferPrescriptionFromLegacy(
  row: LegacyWorkoutExerciseRow,
  opts: { defaultRestBetweenSetsSec?: number | null } = {},
): BackfillResult | null {
  const notes = row.notes ?? "";
  const reps = row.reps ?? "";
  const blob = prescriptionBlob(row);
  const setCount =
    row.sets != null && row.sets > 0
      ? clampSetCount(row.sets)
      : parseCommaSetCount(reps) ?? 1;

  let restBetweenSetsSec =
    row.restSec ??
    opts.defaultRestBetweenSetsSec ??
    DEFAULT_REST_SEC;

  const cleanedNotes = cleanLegacyNotes(row.notes);
  const phases: WorkoutSetPhaseInput[] = [];

  // HIIT / timed rounds
  if (row.setScheme === "timed" || /rounds?\s+on/i.test(blob) || /\d+s\s*on/i.test(reps)) {
    const durationSec = parseTimedSec(reps, notes) ?? 20;
    pushPhase(phases, { phaseType: "TIMED", durationSec, repKind: "FIXED" });
    return {
      prescription: {
        setCount,
        restBetweenSetsSec: durationSec,
        notes: cleanedNotes,
        phases,
      },
      cleanedNotes,
      pattern: "timed_rounds",
      summary: formatPrescriptionPhases({ setCount, phases }),
    };
  }

  const holdSec = extractHoldSec(blob);
  const positionCue = extractPositionCue(blob);
  const fixedAfterHold = extractFixedRepsAfterHold(blob);
  const burnout = isBurnoutText(blob) || /burnout/i.test(reps);
  const numericReps = parseNumericReps(reps);

  if (holdSec) {
    pushPhase(phases, {
      phaseType: "HOLD",
      durationSec: holdSec,
      positionCue,
      repKind: "FIXED",
    });
    if (fixedAfterHold) {
      pushPhase(phases, {
        phaseType: "REPS",
        reps: fixedAfterHold,
        repKind: "FIXED",
      });
      return {
        prescription: {
          setCount,
          restBetweenSetsSec,
          notes: cleanedNotes,
          phases,
        },
        cleanedNotes,
        pattern: "hold_fixed_reps",
        summary: formatPrescriptionPhases({ setCount, phases }),
      };
    }
    if (burnout) {
      pushPhase(phases, { phaseType: "BURNOUT", repKind: "BURNOUT" });
      return {
        prescription: {
          setCount,
          restBetweenSetsSec,
          notes: cleanedNotes,
          phases,
        },
        cleanedNotes,
        pattern: "hold_burnout",
        summary: formatPrescriptionPhases({ setCount, phases }),
      };
    }
  }

  if (burnout && !holdSec) {
    pushPhase(phases, { phaseType: "BURNOUT", repKind: "BURNOUT" });
    return {
      prescription: {
        setCount,
        restBetweenSetsSec,
        notes: cleanedNotes,
        phases,
      },
      cleanedNotes,
      pattern: "burnout_only",
      summary: formatPrescriptionPhases({ setCount, phases }),
    };
  }

  if (numericReps) {
    pushPhase(phases, {
      phaseType: "REPS",
      reps: numericReps,
      repKind: "FIXED",
    });
    return {
      prescription: {
        setCount,
        restBetweenSetsSec,
        notes: cleanedNotes,
        phases,
      },
      cleanedNotes,
      pattern: "standard_reps",
      summary: formatPrescriptionPhases({ setCount, phases }),
    };
  }

  // Warm-up / stretch / notes-only blocks
  if (cleanedNotes || notes) {
    return {
      prescription: {
        setCount: 1,
        restBetweenSetsSec: null,
        notes: cleanedNotes ?? notes,
        phases: [],
      },
      cleanedNotes: cleanedNotes ?? notes,
      pattern: "notes_only",
      summary: "notes only (no structured phases)",
    };
  }

  return null;
}

/** Scan workout items for workout-wide rest (e.g. "Rest periods are 1:30 min"). */
export function inferWorkoutDefaultRestSec(
  rows: LegacyWorkoutExerciseRow[],
): number | null {
  for (const row of rows) {
    const fromNotes = row.notes ? parseRestSecFromText(row.notes) : null;
    if (fromNotes) return fromNotes;
  }
  return null;
}

export function inferWorkoutPrescriptions(
  rows: Array<LegacyWorkoutExerciseRow & { id?: string }>,
): Array<BackfillResult & { id?: string }> {
  const defaultRest = inferWorkoutDefaultRestSec(rows);
  return rows
    .map((row) => {
      const result = inferPrescriptionFromLegacy(row, {
        defaultRestBetweenSetsSec: defaultRest,
      });
      if (!result) return null;
      return { ...result, id: row.id };
    })
    .filter((r): r is BackfillResult & { id?: string } => r != null);
}

/** Attach structured phases to parsed SMS/text upload exercises. */
export function enrichLegacyExerciseRows<T extends LegacyWorkoutExerciseRow>(
  rows: T[],
): Array<(T & BackfillResult) | T> {
  const defaultRest = inferWorkoutDefaultRestSec(rows);
  return rows.map((row) => {
    const result = inferPrescriptionFromLegacy(row, {
      defaultRestBetweenSetsSec: defaultRest,
    });
    if (!result) return row;
    return { ...row, ...result };
  });
}