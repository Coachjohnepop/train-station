import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCompleteWorkoutLog,
  logFailureMessage,
  normalizeLogSessionDate,
  resolveLogSessionDate,
  unfinishedLogExercises,
} from "./member-workout-log";

const squat = {
  id: "we-squat",
  exerciseId: "ex-squat",
  name: "Squat",
  setScheme: "standard",
  repPattern: null,
  reps: "8",
  setCount: 3,
  weightTier: "working",
  past: { startingWeightLbs: 135 },
};

const plank = {
  id: "we-plank",
  exerciseId: "ex-plank",
  name: "Plank",
  setScheme: "timed",
  repPattern: null,
  reps: "45s",
  setCount: 1,
  weightTier: "bodyweight",
  past: { startingWeightLbs: null },
};

describe("workout complete log", () => {
  it("drops enrollment keys so the API never 400s on M1D1 / W1D1", () => {
    assert.equal(normalizeLogSessionDate("W1D1"), undefined);
    assert.equal(normalizeLogSessionDate("M1D1"), undefined);
    assert.equal(normalizeLogSessionDate("2026-08-18"), "2026-08-18");
    assert.equal(resolveLogSessionDate("W1D1", "2026-08-18"), "2026-08-18");
    assert.equal(resolveLogSessionDate(undefined, "2026-08-18"), "2026-08-18");
  });

  it("treats checkoffs as optional — unfinished work still needs a confirm", () => {
    const unfinished = unfinishedLogExercises(
      [squat, plank],
      new Set(),
      { "we-squat": new Set([1]) },
    );
    assert.deepEqual(
      unfinished.map((e) => e.id),
      ["we-plank"],
    );
  });

  it("logs every exercise at 100% even with zero checkoffs", () => {
    const plan = buildCompleteWorkoutLog({
      exercises: [squat, plank],
      finishedIds: [],
      completedSets: {},
      weights: {},
    });
    assert.equal(plan.progress, 100);
    assert.equal(plan.unfinished.length, 2);
    assert.equal(plan.exercises.length, 2);
    assert.equal(plan.exercises[0]?.setsCompleted, 3);
    assert.equal(plan.exercises[0]?.repsCompleted, 24);
    assert.equal(plan.exercises[0]?.startingWeightLbs, 135);
    assert.equal(plan.exercises[1]?.setsCompleted, 1);
    assert.equal(plan.exercises[1]?.repsCompleted, 12);
  });

  it("keeps extra logged sets and typed weight when present", () => {
    const plan = buildCompleteWorkoutLog({
      exercises: [squat],
      finishedIds: ["we-squat"],
      completedSets: { "we-squat": new Set([1, 2, 3, 4]) },
      weights: { "we-squat": "155" },
    });
    assert.equal(plan.unfinished.length, 0);
    assert.equal(plan.exercises[0]?.setsCompleted, 4);
    assert.equal(plan.exercises[0]?.startingWeightLbs, 155);
  });

  it("surfaces a useful message when the API rejected a bad session date", () => {
    assert.equal(
      logFailureMessage({
        detail: { fieldErrors: { sessionDate: ["Invalid"] }, formErrors: [] },
      }),
      "Couldn’t save — the session date was invalid. Try again.",
    );
    assert.equal(logFailureMessage({ detail: "Only yesterday and today can be worked from Today (3-day window)." }), "Only yesterday and today can be worked from Today (3-day window).");
  });
});
