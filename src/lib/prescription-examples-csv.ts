import "server-only";

import fs from "fs";
import path from "path";
import {
  PRESCRIPTION_PATTERN_TYPES,
  type PhaseTypeValue,
  type PrescriptionExampleRow,
  type PrescriptionPatternType,
  type RepKindValue,
} from "@/lib/prescription-example-types";
import { buildPrescriptionSummary } from "@/lib/prescription-example-summary";

const CSV_PATH = path.join(
  process.cwd(),
  "exports",
  "workout-prescription-examples.csv",
);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function intOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function asPatternType(v: string): PrescriptionPatternType {
  const t = v.trim() as PrescriptionPatternType;
  return PRESCRIPTION_PATTERN_TYPES.includes(t) ? t : "standard_reps";
}

function asPhaseType(v: string): PhaseTypeValue {
  const t = v.trim().toLowerCase();
  if (t === "hold" || t === "reps" || t === "burnout" || t === "timed") return t;
  return "";
}

function asRepKind(v: string): RepKindValue {
  const t = v.trim().toLowerCase();
  if (t === "fixed" || t === "burnout" || t === "max") return t;
  return "";
}

export function parsePrescriptionExamplesCsv(text: string): PrescriptionExampleRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows: PrescriptionExampleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const get = (key: string) => cells[headers.indexOf(key)] ?? "";

    const row: PrescriptionExampleRow = {
      id: Number(get("example_id")),
      patternType: asPatternType(get("pattern_type")),
      sampleExercise: get("sample_exercise").trim(),
      setCount: Number(get("set_count")) || 1,
      restBetweenSetsSec: Number(get("rest_between_sets_sec")) || 45,
      weightTier: get("weight_tier").trim() || "medium",
      phase1Type: asPhaseType(get("phase_1_type")),
      phase1DurationSec: intOrNull(get("phase_1_duration_sec")),
      phase1Reps: intOrNull(get("phase_1_reps")),
      phase1RepKind: asRepKind(get("phase_1_rep_kind")),
      phase1PositionCue: get("phase_1_position_cue").trim(),
      phase2Type: asPhaseType(get("phase_2_type")),
      phase2DurationSec: intOrNull(get("phase_2_duration_sec")),
      phase2Reps: intOrNull(get("phase_2_reps")),
      phase2RepKind: asRepKind(get("phase_2_rep_kind")),
      phase2PositionCue: get("phase_2_position_cue").trim(),
      notes: get("notes").trim(),
      summary: get("summary").trim(),
    };
    if (!row.summary) row.summary = buildPrescriptionSummary(row);
    rows.push(row);
  }
  return rows;
}

export function loadPrescriptionExamplesFromCsv(): PrescriptionExampleRow[] {
  if (!fs.existsSync(CSV_PATH)) return [];
  return parsePrescriptionExamplesCsv(fs.readFileSync(CSV_PATH, "utf8"));
}