#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  inferWorkoutTitleFromExercises,
  isGenericWorkoutTitle,
  repairedStoredWorkoutTitle,
  salvageGenericWorkoutTitle,
  workoutContentTitle,
} from "../src/lib/workout-content-name.ts";

assert.equal(isGenericWorkoutTitle("Workout"), true);
assert.equal(isGenericWorkoutTitle("Workout · Main"), true);
assert.equal(isGenericWorkoutTitle("Fasted cardio"), false);

assert.equal(workoutContentTitle("Day 20 Fasted Cardio Gym"), "Fasted Cardio");
assert.equal(repairedStoredWorkoutTitle("Day 20 Fasted Cardio Gym"), null);
assert.equal(repairedStoredWorkoutTitle("S1D-1783785459241 W2 Sat Gym"), null);
assert.equal(repairedStoredWorkoutTitle("Day 20 (Gym)"), null);

assert.equal(
  inferWorkoutTitleFromExercises(["Fasted Cardio", "Cool Down & Stretch"]),
  "Fasted cardio",
);
assert.equal(
  inferWorkoutTitleFromExercises([
    "Lat Pull",
    "Bent Over Row",
    "Double Arm Bicep Curls",
  ]),
  "Back & biceps",
);

assert.equal(
  salvageGenericWorkoutTitle("Workout", ["Fasted Cardio", "Cool Down & Stretch"]),
  "Fasted cardio",
);
assert.equal(salvageGenericWorkoutTitle("Workout · PM Session", []), "PM session");
assert.equal(salvageGenericWorkoutTitle("Workout", []), "Unassigned");

console.log("workout-content-name-test: ok");
