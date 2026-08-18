import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultProgramStartDate,
  orderedProgramStartDateOptions,
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
