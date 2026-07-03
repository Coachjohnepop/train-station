import {
  parseSmsWorkout,
  type ParsedSmsExercise,
  type ParsedSmsWorkout,
} from "@/lib/sms-workout-parser";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitNoteLines(notes?: string): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\n|(?:\s*·\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatMainExercise(ex: ParsedSmsExercise): string[] {
  const lines: string[] = [];
  const noteParts = splitNoteLines(ex.notes);
  const eachLeg = noteParts.some((n) => /^each\s+leg$/i.test(n));
  const eachArm = noteParts.some((n) => /^each\s+arm$/i.test(n));
  const coachingNotes = noteParts.filter((n) => !/^each\s+(leg|arm)$/i.test(n));

  const inlineRep =
    ex.setScheme !== "timed" &&
    ex.reps &&
    ex.reps !== "—" &&
    !ex.reps.includes(",") &&
    /^\d+$/.test(ex.reps) &&
    ex.sets === 1;

  if (inlineRep) {
    lines.push(`${ex.name} ${ex.reps}`);
  } else {
    lines.push(ex.name);
  }

  for (const note of coachingNotes) {
    lines.push(note);
  }

  if (ex.setScheme === "timed") {
    const secOn = ex.reps.match(/^(\d+)s\s+on/i)?.[1];
    if (secOn && ex.sets > 1) {
      lines.push(`${ex.sets} rounds on ${secOn}sec`);
    } else if (ex.reps.includes("/")) {
      lines.push(
        ex.reps
          .replace(/\s*(\d+)s\s+on\s*/i, "$1 sec on ")
          .replace(/\s*(\d+)s\s+off/i, "$1 sec off"),
      );
    } else if (ex.reps && ex.reps !== "—") {
      lines.push(ex.reps);
    }
    return lines;
  }

  if (ex.reps && ex.reps !== "—" && ex.reps.includes(",")) {
    lines.push(ex.reps.replace(/\s/g, ""));
    if (eachArm) lines.push("each arm");
    return lines;
  }

  if (ex.sets > 1) {
    if (eachLeg) lines.push(`${ex.sets} sets each leg`);
    else lines.push(`${ex.sets} sets`);
  }

  if (ex.reps && ex.reps !== "—" && !ex.reps.includes(",") && !inlineRep) {
    lines.push(ex.reps);
  }

  if (eachArm && !lines.some((l) => /each\s+arm/i.test(l))) {
    lines.push("each arm");
  }

  return lines;
}

/** Deterministic plain-text export from parsed workout blocks. */
export function formatParsedWorkoutAsSms(workout: ParsedSmsWorkout): string {
  const blocks: string[] = [];

  if (workout.title && workout.title !== "Coach SMS Workout") {
    blocks.push(workout.title);
  }

  for (const ex of workout.exercises) {
    if (ex.section === "warmup") {
      const warmupLines = ex.notes
        ? ex.notes
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : ex.name === "Warm-up"
          ? []
          : [ex.name];
      if (warmupLines.length > 0) blocks.push(warmupLines.join("\n"));
      continue;
    }

    if (ex.section === "cooldown") {
      if (/stretch/i.test(ex.name) || /stretch/i.test(ex.notes ?? "")) {
        blocks.push(ex.notes?.trim() && !/^stretch\s*$/i.test(ex.notes) ? ex.notes.trim() : "Stretch");
      } else {
        blocks.push([ex.name, ex.notes?.trim()].filter(Boolean).join("\n"));
      }
      continue;
    }

    if (ex.section === "notes") {
      if (ex.notes?.trim()) blocks.push(ex.notes.trim());
      continue;
    }

    blocks.push(formatMainExercise(ex).join("\n"));
  }

  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function getCertifiableWorkoutText(
  normalizedText: string | undefined,
  workout: ParsedSmsWorkout,
): string {
  const trimmed = normalizedText?.trim().replace(/\r\n/g, "\n");
  if (trimmed) return trimmed;
  return formatParsedWorkoutAsSms(workout);
}

export type WorkoutExportValidation = {
  ok: boolean;
  issues: string[];
  exportText: string;
  reparsed: ParsedSmsWorkout;
};

export function validateWorkoutExportText(
  exportText: string,
  source: ParsedSmsWorkout,
): WorkoutExportValidation {
  const text = exportText.trim().replace(/\r\n/g, "\n");
  const reparsed = parseSmsWorkout(text);
  const issues: string[] = [];

  if (!text) {
    issues.push("Export text is empty.");
    return { ok: false, issues, exportText: text, reparsed };
  }

  if (reparsed.exercises.length === 0) {
    issues.push("Re-parse found no exercises.");
  }

  if (reparsed.exercises.length !== source.exercises.length) {
    issues.push(
      `Exercise count mismatch: expected ${source.exercises.length}, re-parse got ${reparsed.exercises.length}.`,
    );
  }

  const len = Math.min(reparsed.exercises.length, source.exercises.length);
  for (let i = 0; i < len; i++) {
    const expected = source.exercises[i];
    const got = reparsed.exercises[i];
    if (normalizeName(expected.name) !== normalizeName(got.name)) {
      issues.push(`Block ${i + 1}: expected "${expected.name}", got "${got.name}".`);
    }
    if (expected.sets !== got.sets) {
      issues.push(`"${expected.name}": expected ${expected.sets} set(s), re-parse got ${got.sets}.`);
    }
  }

  return { ok: issues.length === 0, issues, exportText: text, reparsed };
}

/** Prefer normalized interpreter text when it round-trips; otherwise use formatted export. */
export function resolveCertifiedExportText(
  normalizedText: string | undefined,
  workout: ParsedSmsWorkout,
): { text: string; validation: WorkoutExportValidation; source: "normalized" | "formatted" } {
  const normalized = getCertifiableWorkoutText(normalizedText, workout);
  const normalizedValidation = validateWorkoutExportText(normalized, workout);
  if (normalizedValidation.ok) {
    return { text: normalized, validation: normalizedValidation, source: "normalized" };
  }

  const formatted = formatParsedWorkoutAsSms(workout);
  const formattedValidation = validateWorkoutExportText(formatted, workout);
  return {
    text: formattedValidation.ok ? formatted : normalized,
    validation: formattedValidation.ok ? formattedValidation : normalizedValidation,
    source: formattedValidation.ok ? "formatted" : "normalized",
  };
}