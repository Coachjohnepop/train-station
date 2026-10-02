import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awardPointsForPlan,
  CYCLE_ACTIONS_PER_WORKOUT,
  CYCLE_WORKOUT_COUNT,
  cycleGoalForPlan,
  DEFAULT_GAMIFICATION_POINTS,
  FREE_CYCLE_GOAL_POINTS,
  FREE_POINT_STEP,
  normalizeGamificationPoints,
  PAID_CYCLE_GOAL_POINTS,
  paidAwardFromFreeScale,
  roundPointsUpToTen,
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

  it("makes 3 workouts a week for 28 days clear the 2,000-point paid cycle", () => {
    const perAction = awardPointsForPlan(FREE_POINT_STEP, "member");
    const cycle = CYCLE_WORKOUT_COUNT * CYCLE_ACTIONS_PER_WORKOUT * perAction;
    assert.equal(cycleGoalForPlan("member"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("business"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("first_class"), PAID_CYCLE_GOAL_POINTS);
    assert.equal(cycleGoalForPlan("explorer"), FREE_CYCLE_GOAL_POINTS);
    assert.equal(FREE_CYCLE_GOAL_POINTS, 240);
    assert.equal(PAID_CYCLE_GOAL_POINTS, 2000);
    assert.equal(perAction, 90);
    // 12 × (set 90 + log 90) = 2,160 — over the 2,000 goal.
    assert.equal(cycle, 2160);
    assert.ok(cycle > PAID_CYCLE_GOAL_POINTS);
  });

  it("rounds each paid award up to the nearest 10", () => {
    assert.equal(roundPointsUpToTen(0), 0);
    assert.equal(roundPointsUpToTen(80), 80);
    assert.equal(roundPointsUpToTen(83), 90);
    assert.equal(roundPointsUpToTen(83.333), 90);
    assert.equal(paidAwardFromFreeScale(10), 90);
  });

  it("pays extra actions more than a set so members can go over the goal", () => {
    assert.equal(DEFAULT_GAMIFICATION_POINTS.set_logged, 10);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.workout_logged, 10);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.warmup_before_live, 20);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.first_workout, 30);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.intake_scheduled, 30);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.measurements_logged, 20);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.food_track_day, 20);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.intake_complete, 20);
    assert.equal(DEFAULT_GAMIFICATION_POINTS.onboarding_complete, 20);
    assert.equal(paidAwardFromFreeScale(20), 170);
    assert.equal(paidAwardFromFreeScale(30), 250);
    const extras =
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.warmup_before_live) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.first_workout) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.intake_scheduled) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.measurements_logged) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.food_track_day) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.intake_complete) +
      paidAwardFromFreeScale(DEFAULT_GAMIFICATION_POINTS.onboarding_complete);
    assert.ok(extras > 0);
  });

  it("lifts flattened extra awards off the 10-point set table", () => {
    const lifted = normalizeGamificationPoints({
      warmup_before_live: 10,
      intake_scheduled: 10,
      workout_logged: 10,
      set_logged: 10,
      intake_complete: 10,
      onboarding_complete: 10,
    });
    assert.equal(lifted.set_logged, 10);
    assert.equal(lifted.workout_logged, 10);
    assert.equal(lifted.warmup_before_live, 20);
    assert.equal(lifted.first_workout, 30);
    assert.equal(lifted.intake_scheduled, 30);
    assert.equal(lifted.measurements_logged, 20);
    assert.equal(lifted.food_track_day, 20);
    const custom = normalizeGamificationPoints({
      warmup_before_live: 40,
      intake_scheduled: 10,
      workout_logged: 10,
      set_logged: 10,
      intake_complete: 10,
      onboarding_complete: 10,
    });
    assert.equal(custom.warmup_before_live, 40);
  });
});
