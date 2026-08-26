import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEMBER_CATCH_UP_DAYS,
  canLogSessionDate,
  isCatchUpSessionDate,
  lateAdjustedPoints,
} from "./member-workout-late";

describe("member catch-up window", () => {
  it("allows today and the last 5 calendar days", () => {
    assert.equal(canLogSessionDate("2026-08-21", "2026-08-21").ok, true);
    assert.equal(canLogSessionDate("2026-08-16", "2026-08-21").ok, true);
    assert.equal(MEMBER_CATCH_UP_DAYS, 5);
  });

  it("blocks tomorrow and days older than 5", () => {
    assert.equal(canLogSessionDate("2026-08-22", "2026-08-21").ok, false);
    assert.equal(canLogSessionDate("2026-08-15", "2026-08-21").ok, false);
  });

  it("treats a past program day as catch-up", () => {
    assert.equal(isCatchUpSessionDate("2026-08-18", "2026-08-21"), true);
    assert.equal(isCatchUpSessionDate("2026-08-21", "2026-08-21"), false);
  });

  it("awards full points for catch-up (logs as today)", () => {
    assert.deepEqual(lateAdjustedPoints(100, "2026-08-18", "2026-08-21"), {
      points: 100,
      late: false,
      hitPercent: 0,
    });
  });
});
