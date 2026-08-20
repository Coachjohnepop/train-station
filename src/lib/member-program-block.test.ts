import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultProgramStartDate,
  orderedProgramStartDateOptions,
  personalCoordinateForCalendarDate,
  recommendedProgramStartDate,
} from "./member-program-block";

describe("program start dates", () => {
  it("defaults to the signup day", () => {
    assert.equal(defaultProgramStartDate("2026-08-18", { recommendWeekday: 1 }), "2026-08-18");
  });

  it("still recommends the next Monday", () => {
    assert.equal(
      recommendedProgramStartDate("2026-08-18", { recommendWeekday: 1, maxOffsetDays: 6 }),
      "2026-08-24",
    );
  });

  it("lists today first, then recommended Monday", () => {
    const rows = orderedProgramStartDateOptions("2026-08-18", {
      recommendWeekday: 1,
      maxOffsetDays: 6,
    });
    assert.equal(rows[0]?.iso, "2026-08-18");
    assert.equal(rows[0]?.sameDay, true);
    assert.equal(rows[1]?.iso, "2026-08-24");
    assert.equal(rows[1]?.recommended, true);
  });
});

describe("personalCoordinateForCalendarDate", () => {
  it("maps the member's first calendar day to W1D1, not the shared gym calendar", () => {
    // Adult catalog calendarDate for 2026-08-20 is W9D4 Back/Bicep.
    // A member whose program starts that day must still get Day 1 (Upper Body).
    assert.deepEqual(personalCoordinateForCalendarDate("2026-08-20", "2026-08-20"), {
      weekNumber: 1,
      dayNumber: 1,
      linearDay: 1,
    });
  });

  it("advances one program day per calendar day from the member's start", () => {
    assert.deepEqual(personalCoordinateForCalendarDate("2026-08-20", "2026-08-21"), {
      weekNumber: 1,
      dayNumber: 2,
      linearDay: 2,
    });
    assert.deepEqual(personalCoordinateForCalendarDate("2026-08-20", "2026-08-26"), {
      weekNumber: 1,
      dayNumber: 7,
      linearDay: 7,
    });
    assert.deepEqual(personalCoordinateForCalendarDate("2026-08-20", "2026-08-27"), {
      weekNumber: 2,
      dayNumber: 1,
      linearDay: 8,
    });
  });

  it("returns null before start, after the block, or with no start date", () => {
    assert.equal(personalCoordinateForCalendarDate("2026-08-20", "2026-08-19"), null);
    assert.equal(personalCoordinateForCalendarDate("2026-08-20", "2026-09-17"), null);
    assert.equal(personalCoordinateForCalendarDate(null, "2026-08-20"), null);
    assert.equal(personalCoordinateForCalendarDate("", "2026-08-20"), null);
  });
});
