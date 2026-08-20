import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADULT_WEEK_FLOW, adultWeekFlowDay } from "./adult-week-flow";
import { personalCoordinateForCalendarDate } from "./member-program-block";

describe("adult week flow", () => {
  it("is upper / lower / fasted cardio / upper / lower / stretch / meal prep", () => {
    assert.deepEqual(
      ADULT_WEEK_FLOW.map((d) => `${d.dayNumber}:${d.title}`),
      [
        "1:Upper Body",
        "2:Lower Body",
        "3:Fasted Cardio",
        "4:Upper Body",
        "5:Lower Body",
        "6:Active Recovery Stretch",
        "7:Rest and Meal Prep",
      ],
    );
  });

  it("maps a member's first seven calendar days onto that sequence", () => {
    const start = "2026-08-20";
    const titles = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const iso = `2026-08-${String(20 + offset).padStart(2, "0")}`;
      const personal = personalCoordinateForCalendarDate(start, iso);
      assert.ok(personal);
      const day = adultWeekFlowDay(personal.dayNumber);
      assert.ok(day);
      return day.title;
    });
    assert.deepEqual(titles, [
      "Upper Body",
      "Lower Body",
      "Fasted Cardio",
      "Upper Body",
      "Lower Body",
      "Active Recovery Stretch",
      "Rest and Meal Prep",
    ]);
  });
});
