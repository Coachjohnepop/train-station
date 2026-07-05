#!/usr/bin/env node
/**
 * Regenerate exports/workout-prescription-examples.csv
 *
 * Usage: node scripts/generate-prescription-examples-csv.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";

const MAX_SETS = 10;
const MAX_REPS = 30;

const exercises = {
  standard_reps: "Bench Press",
  hold_burnout: "Leg Press Machine",
  hold_fixed_reps: "Standing Calf Raises",
  timed_rounds: "Jump Squats",
  burnout_only: "Close Burnout Push-ups",
  hold_only: "Plank",
  hold_then_timed: "Wall Sit",
};

const examples = [];
let id = 1;

function add(pattern, fields) {
  examples.push({ example_id: id++, pattern_type: pattern, ...fields });
}

const standardPairs = [
  [1, 5],
  [2, 8],
  [3, 10],
  [4, 12],
  [5, 15],
  [6, 20],
  [7, 25],
  [8, 30],
  [9, 12],
  [10, 10],
];
for (const [sets, reps] of standardPairs) {
  add("standard_reps", {
    sample_exercise: exercises.standard_reps,
    set_count: sets,
    rest_between_sets_sec: 90,
    weight_tier: sets <= 3 ? "heavy" : "medium",
    phase_1_type: "reps",
    phase_1_duration_sec: "",
    phase_1_reps: reps,
    phase_1_rep_kind: "fixed",
    phase_1_position_cue: "",
    phase_2_type: "",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: "",
    summary: `${sets} sets × ${reps} reps`,
  });
}

const holdBurnout = [
  [4, 20, "bottom of lift"],
  [3, 30, "top squeeze"],
  [4, 15, "bottom of squat"],
  [5, 20, "top squeeze"],
  [3, 45, "mid range"],
  [4, 10, "bottom of lift"],
  [2, 30, "top squeeze"],
  [6, 20, "bottom of lunge"],
  [4, 25, "top squeeze"],
  [3, 20, "bottom of lift"],
];
for (const [sets, hold, cue] of holdBurnout) {
  add("hold_burnout", {
    sample_exercise: exercises.hold_burnout,
    set_count: sets,
    rest_between_sets_sec: 90,
    weight_tier: "medium",
    phase_1_type: "hold",
    phase_1_duration_sec: hold,
    phase_1_reps: "",
    phase_1_rep_kind: "",
    phase_1_position_cue: cue,
    phase_2_type: "burnout",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "burnout",
    phase_2_position_cue: "",
    notes: "Log highest rep count achieved",
    summary: `${sets} sets: ${hold}s hold (${cue}) → burnout reps`,
  });
}

const holdFixed = [
  [4, 30, 15, "top squeeze"],
  [3, 20, 10, "bottom of lift"],
  [4, 30, 5, "top squeeze"],
  [5, 15, 12, "peak contraction"],
  [3, 45, 8, "top squeeze"],
  [4, 20, 30, "bottom of lift"],
  [2, 30, 6, "top squeeze"],
  [6, 15, 25, "bottom of lift"],
  [4, 25, 5, "top squeeze"],
  [3, 20, 20, "bottom of lift"],
];
for (const [sets, hold, reps, cue] of holdFixed) {
  add("hold_fixed_reps", {
    sample_exercise: exercises.hold_fixed_reps,
    set_count: sets,
    rest_between_sets_sec: 90,
    weight_tier: "medium",
    phase_1_type: "hold",
    phase_1_duration_sec: hold,
    phase_1_reps: "",
    phase_1_rep_kind: "",
    phase_1_position_cue: cue,
    phase_2_type: "reps",
    phase_2_duration_sec: "",
    phase_2_reps: reps,
    phase_2_rep_kind: "fixed",
    phase_2_position_cue: "",
    notes: "Reps immediately after hold",
    summary: `${sets} sets: ${hold}s hold (${cue}) → ${reps} reps`,
  });
}

const timed = [
  [8, 20],
  [10, 30],
  [6, 40],
  [12, 15],
  [5, 45],
  [8, 20],
  [4, 60],
  [10, 20],
  [7, 30],
  [9, 25],
];
for (const [rounds, sec] of timed) {
  add("timed_rounds", {
    sample_exercise: exercises.timed_rounds,
    set_count: rounds,
    rest_between_sets_sec: sec,
    weight_tier: "light",
    phase_1_type: "timed",
    phase_1_duration_sec: sec,
    phase_1_reps: "",
    phase_1_rep_kind: "",
    phase_1_position_cue: "",
    phase_2_type: "",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: "Work interval; rest = rest_between_sets_sec",
    summary: `${rounds} rounds × ${sec}s on`,
  });
}

for (let i = 0; i < 10; i++) {
  const sets = [1, 2, 3, 4, 5, 3, 4, 2, 5, 4][i];
  add("burnout_only", {
    sample_exercise: exercises.burnout_only,
    set_count: sets,
    rest_between_sets_sec: 60,
    weight_tier: "medium",
    phase_1_type: "burnout",
    phase_1_duration_sec: "",
    phase_1_reps: "",
    phase_1_rep_kind: "burnout",
    phase_1_position_cue: "",
    phase_2_type: "",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: "Log highest rep count per set",
    summary: `${sets} sets to burnout`,
  });
}

const holds = [30, 45, 60, 20, 40, 30, 50, 25, 35, 60];
for (let i = 0; i < 10; i++) {
  const sets = (i % 5) + 1;
  add("hold_only", {
    sample_exercise: exercises.hold_only,
    set_count: sets,
    rest_between_sets_sec: 45,
    weight_tier: "light",
    phase_1_type: "hold",
    phase_1_duration_sec: holds[i],
    phase_1_reps: "",
    phase_1_rep_kind: "",
    phase_1_position_cue: "locked position",
    phase_2_type: "",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: "Isometric — log hold time if needed",
    summary: `${sets} sets × ${holds[i]}s hold`,
  });
}

const holdTimed = [
  [4, 10, 20],
  [3, 15, 30],
  [5, 20, 15],
  [4, 30, 20],
  [2, 45, 30],
  [6, 10, 20],
  [3, 20, 25],
  [4, 15, 20],
  [5, 25, 15],
  [3, 30, 20],
];
for (const [sets, hold, work] of holdTimed) {
  add("hold_then_timed", {
    sample_exercise: exercises.hold_then_timed,
    set_count: sets,
    rest_between_sets_sec: 60,
    weight_tier: "medium",
    phase_1_type: "hold",
    phase_1_duration_sec: hold,
    phase_1_reps: "",
    phase_1_rep_kind: "",
    phase_1_position_cue: "setup position",
    phase_2_type: "timed",
    phase_2_duration_sec: work,
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: "Hold then timed work in same set",
    summary: `${sets} sets: ${hold}s hold → ${work}s work`,
  });
}

const maxReps = [
  [3, 30],
  [4, 25],
  [2, 10],
  [5, 12],
  [3, 8],
  [4, 30],
  [6, 10],
  [3, 15],
  [4, 28],
  [2, 30],
];
for (const [sets, cap] of maxReps) {
  add("max_reps", {
    sample_exercise: "Goblet Squat",
    set_count: sets,
    rest_between_sets_sec: 90,
    weight_tier: "medium",
    phase_1_type: "reps",
    phase_1_duration_sec: "",
    phase_1_reps: cap,
    phase_1_rep_kind: "max",
    phase_1_position_cue: "",
    phase_2_type: "",
    phase_2_duration_sec: "",
    phase_2_reps: "",
    phase_2_rep_kind: "",
    phase_2_position_cue: "",
    notes: `As many reps as possible up to ${cap}`,
    summary: `${sets} sets × max ${cap} reps`,
  });
}

const headers = [
  "example_id",
  "pattern_type",
  "sample_exercise",
  "set_count",
  "rest_between_sets_sec",
  "weight_tier",
  "phase_1_type",
  "phase_1_duration_sec",
  "phase_1_reps",
  "phase_1_rep_kind",
  "phase_1_position_cue",
  "phase_2_type",
  "phase_2_duration_sec",
  "phase_2_reps",
  "phase_2_rep_kind",
  "phase_2_position_cue",
  "notes",
  "summary",
];

const esc = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv =
  [headers.join(",")]
    .concat(examples.map((e) => headers.map((h) => esc(e[h])).join(",")))
    .join("\n") + "\n";

mkdirSync("exports", { recursive: true });
const out = "exports/workout-prescription-examples.csv";
writeFileSync(out, csv);

const counts = {};
for (const e of examples) counts[e.pattern_type] = (counts[e.pattern_type] || 0) + 1;
console.log(`Wrote ${out} — ${examples.length} rows (max ${MAX_SETS} sets, max ${MAX_REPS} reps)`);
console.log(counts);