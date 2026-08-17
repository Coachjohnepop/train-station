#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  shouldAutoFinishExercise,
  nextUnfinishedExerciseId,
  isFinishTapLocked,
} from "../src/lib/member-exercise-finish.ts";
import { collapseConsecutiveCloneExercises } from "../src/lib/member-workout-lines.ts";

assert.equal(
  shouldAutoFinishExercise({
    alreadyFinished: false,
    setCount: 0,
    completedSetCount: 0,
    isTimed: false,
    completedHasFirstSet: false,
  }),
  false,
  "zero-set cards must not auto-finish",
);

assert.equal(
  shouldAutoFinishExercise({
    alreadyFinished: false,
    setCount: 3,
    completedSetCount: 3,
    isTimed: false,
    completedHasFirstSet: false,
  }),
  true,
);

assert.equal(
  shouldAutoFinishExercise({
    alreadyFinished: false,
    setCount: 3,
    completedSetCount: 0,
    isTimed: true,
    completedHasFirstSet: true,
  }),
  true,
  "timed: first set marks the card done",
);

const ids = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.equal(nextUnfinishedExerciseId(ids, "a", new Set(["a"])), "b");
assert.equal(nextUnfinishedExerciseId(ids, "a", new Set(["a", "b"])), "c");
assert.equal(nextUnfinishedExerciseId(ids, "c", new Set(["c"])), null);

assert.equal(isFinishTapLocked(Date.now() + 400), true);
assert.equal(isFinishTapLocked(Date.now() - 10), false);

const collapsed = collapseConsecutiveCloneExercises([
  { exerciseId: "curl", setCount: 3, reps: "20-30", setScheme: "standard" },
  { exerciseId: "curl", setCount: 3, reps: "20-30", setScheme: "standard" },
  { exerciseId: "tri", setCount: 3, reps: "20", setScheme: "standard" },
]);
assert.equal(collapsed.length, 2);
assert.equal(collapsed[1].exerciseId, "tri");

console.log("member-exercise-finish-test: ok");
