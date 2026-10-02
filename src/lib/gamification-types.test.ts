import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awardPointsForPlan,
  CYCLE_ACTIONS_PER_WORKOUT,
  CYCLE_WORKOUT_COUNT,
  cycleGoalForPlan,
  FREE_CYCLE_GOAL_POINTS,
  FREE_POINT_STEP,
  PAID_CYCLE_GOAL_POINTS,
  paidAwardFromFreeScale,
} from "./gamification-types";

describe("paid scoring is the same for Coach, Business, and 1st Class", () => {
  it("awards the same points on every paid ticket", () => {
    const plans = [
      "member",
      "coach_class",
      "Coach Class",
      "business",
      "business_class",
      "pro",
      "first_class",
      "1st_class",
    ];
    const paid = plans.map((plan) => awardPointsForPlan(10, plan));
    assert.ok(paid.every((n) => n === paid[0]));
    assert.equal(paid[0], paidAwardFromFreeScale(10));
    assert.notEqual(paid[0], awardPointsForPlan(10, "explorer"));
  });

  it("makes 3 workouts a week for 28 days the 2,000-point paid cycle", () => {
    const perAction = awardPointsForPlan(FREE_POINT_STEP, "member");
    const cycle = CYCLE_WORKOUT_COUNT * CYCLE_ACTIONS_PER_WORKOUT * perAction;
    assert.equal(cycleGoalForPlan("member"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("business"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("first_class"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("explorer"), FREE_CYCLE_GOAL_POINTS);
    assert.equal(FREE_CYCLE_GOAL_POINTS, 240);
    assert.equal(PAID_CYCLE_GOAL_POINTS, 2000);
    // 12 × (set 83 + log 83) = 1,992 — the 2,000 goal.
    assert.equal(cycle, 1992);
    assert.ok(Math.abs(cycle - PAID_CYCLE_GOAL_POINTS) <= 10);
  });
});
