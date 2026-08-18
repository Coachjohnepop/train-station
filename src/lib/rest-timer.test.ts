import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseHoldDurationSeconds,
  resolveExerciseHoldSeconds,
  resolveRestSeconds,
} from "./rest-timer";

describe("rest-timer holds vs rest", () => {
  it("parses explicit hold durations", () => {
    assert.equal(parseHoldDurationSeconds("45s"), 45);
    assert.equal(parseHoldDurationSeconds("2 min"), 120);
    assert.equal(parseHoldDurationSeconds("1:30"), 90);
  });

  it("does not start a hold after a standard 5-min bike set", () => {
    assert.equal(
      resolveExerciseHoldSeconds({
        setScheme: "standard",
        reps: "5 min",
        setCount: 1,
        timedApproach: false,
      }),
      null,
    );
  });

  it("starts a hold only for timed-approach sets", () => {
    assert.equal(
      resolveExerciseHoldSeconds({
        setScheme: "timed",
        reps: "45s",
        setCount: 1,
        timedApproach: true,
      }),
      45,
    );
    assert.equal(
      resolveExerciseHoldSeconds({
        setScheme: "timed",
        reps: null,
        setCount: 2,
        timedApproach: true,
      }),
      120,
    );
  });

  it("uses workout rest when exercise has no restSec", () => {
    assert.equal(
      resolveRestSeconds({
        workoutRestEnabled: true,
        workoutRestSeconds: 60,
      }),
      60,
    );
  });
});
