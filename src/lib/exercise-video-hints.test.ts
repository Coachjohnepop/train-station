import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hintVideoUrlForExerciseName } from "./exercise-video-hints";

describe("hintVideoUrlForExerciseName", () => {
  it("covers the Back/Bicep lines Todd hit with no library video", () => {
    assert.ok(hintVideoUrlForExerciseName("Dumbbell Shrugs"));
    assert.ok(hintVideoUrlForExerciseName("Abdominal Bicycles"));
    assert.ok(hintVideoUrlForExerciseName("HIIT Cardio Intervals"));
    assert.ok(hintVideoUrlForExerciseName("General Warm Up + Shoulder Mobility"));
  });

  it("covers Upper Body sit-ups for Day 1", () => {
    assert.ok(hintVideoUrlForExerciseName("Sit Ups"));
  });
});
