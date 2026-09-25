import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarIsoForEnrollmentDay } from "./member-program-block";

describe("calendarIsoForEnrollmentDay", () => {
  it("maps a member's M1D2 to the day after their start date", () => {
    assert.equal(calendarIsoForEnrollmentDay("2026-09-22", 1, 2), "2026-09-23");
    assert.equal(calendarIsoForEnrollmentDay("2026-09-22", 1, 4), "2026-09-25");
  });
});
