#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  isRestOrDayOffContent,
  isStandardWarmupLineName,
  workoutHasStandardWarmup,
} from "../src/lib/warmup-template.ts";

assert.equal(isStandardWarmupLineName("General Warm Up + Shoulder Mobility"), true);
assert.equal(isStandardWarmupLineName("Band Lat Pull Downs"), false);
assert.equal(isStandardWarmupLineName("Cool Down & Stretch"), false);
assert.equal(
  workoutHasStandardWarmup(["Double Arm Bicep Curls", "Warm up well 5 min bike"]),
  true,
);

assert.equal(
  isRestOrDayOffContent({
    workoutName: "Session",
    exerciseNames: ["Rest & Active Recovery", "Meal Prep"],
  }),
  true,
);
assert.equal(
  isRestOrDayOffContent({ optionLabel: "Day Off", workoutName: "Unassigned" }),
  true,
);
assert.equal(
  isRestOrDayOffContent({
    workoutName: "Fasted cardio",
    exerciseNames: ["Fasted Cardio"],
  }),
  false,
);
assert.equal(
  isRestOrDayOffContent({
    workoutName: "PM session",
    exerciseNames: ["1 Mile Run"],
  }),
  false,
);

console.log("warmup-coverage-test: ok");
