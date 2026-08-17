#!/usr/bin/env node
import assert from "node:assert/strict";

const weeks = [
  { weekNumber: 1, macroPhaseIndex: 1, phaseWeekNumber: 1 },
  { weekNumber: 2, macroPhaseIndex: 1, phaseWeekNumber: 2 },
  { weekNumber: 3, macroPhaseIndex: 2, phaseWeekNumber: 1 },
];

const wantWeek = 3;
const byAbsolute = weeks.find((w) => w.weekNumber === wantWeek);
const byPhase = weeks.find(
  (w) => (w.macroPhaseIndex ?? 1) === 1 && (w.phaseWeekNumber ?? w.weekNumber) === wantWeek,
);

assert.equal(byPhase, undefined, "phase 1 + week-in-phase 3 must miss Adult W3");
assert.equal(byAbsolute?.weekNumber, 3, "absolute week 3 is the Day 20 row");

console.log("program-week-lookup-test: ok");
