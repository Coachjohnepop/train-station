import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_DAY_MARK,
  formatCycleDayFromWeekDay,
  memberWorkoutDayLabel,
} from "./program-cycle-day";

describe("memberWorkoutDayLabel", () => {
  it("prints M1D4 for week 1 day 4", () => {
    assert.equal(formatCycleDayFromWeekDay(1, 4), "M1D4");
    assert.equal(memberWorkoutDayLabel(1, 4), "M1D4");
  });

  it("marks a coach class on that program day", () => {
    assert.equal(memberWorkoutDayLabel(1, 4, { classOverride: true }), `M1D4 · ${CLASS_DAY_MARK}`);
  });

  it("rolls into month 2", () => {
    assert.equal(memberWorkoutDayLabel(5, 1), "M2D1");
  });
});
