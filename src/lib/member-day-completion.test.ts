import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayWorkoutCompleted, markDaysCompleted } from "./member-day-completion";
import type { MemberDaySummary } from "./member-day-window-types";

function stub(partial: Partial<MemberDaySummary>): MemberDaySummary {
  return {
    iso: "W1D1",
    phase: "past",
    weekday: "Mon",
    shortDate: "Aug 18",
    dayLabel: "Day 1",
    weekNumber: 1,
    dayNumber: 1,
    workoutName: "Upper",
    workoutId: "w-upper",
    programSlug: "adult",
    completed: false,
    exerciseCount: 0,
    exerciseNames: [],
    stretchNames: [],
    smsOverride: false,
    hasWorkout: true,
    daysFromToday: -1,
    visibilityTier: "full",
    themeLabel: null,
    ...partial,
  };
}

describe("dayWorkoutCompleted", () => {
  it("marks a day done when the program workout id was logged", () => {
    const day = stub({ workoutId: "sms-w-1" });
    assert.equal(dayWorkoutCompleted(day, new Set(["sms-w-1"]), new Set()), true);
  });

  it("marks a day done when any workout was logged on that calendar date", () => {
    const day = stub({
      iso: "W1D1",
      calendarDate: "2026-08-18",
      workoutId: "w-upper",
    });
    assert.equal(
      dayWorkoutCompleted(day, new Set(), new Set(["2026-08-18"])),
      true,
    );
  });

  it("marks swipe-calendar days done from the iso date", () => {
    const day = stub({ iso: "2026-08-18", calendarDate: undefined, workoutId: null });
    assert.equal(
      dayWorkoutCompleted(day, new Set(), new Set(["2026-08-18"])),
      true,
    );
  });

  it("stays open when nothing matches", () => {
    const day = stub({ calendarDate: "2026-08-19", workoutId: "w-cardio" });
    assert.equal(
      dayWorkoutCompleted(day, new Set(["other"]), new Set(["2026-08-18"])),
      false,
    );
  });

  it("stamps completed on a window of days", () => {
    const days = markDaysCompleted(
      [
        stub({ iso: "2026-08-18", calendarDate: "2026-08-18", workoutId: "a" }),
        stub({ iso: "2026-08-19", calendarDate: "2026-08-19", workoutId: "b" }),
      ],
      new Set(),
      new Set(["2026-08-18"]),
    );
    assert.equal(days[0].completed, true);
    assert.equal(days[1].completed, false);
  });

  it("marks the enrollment day left of today complete from the calendar date", () => {
    const days = markDaysCompleted(
      [
        stub({
          iso: "W1D1",
          calendarDate: undefined,
          daysFromToday: -1,
          workoutId: "w-upper",
        }),
        stub({
          iso: "W1D2",
          calendarDate: undefined,
          daysFromToday: 0,
          workoutId: "w-lower",
        }),
      ],
      new Set(),
      new Set(["2026-08-18"]),
      "2026-08-19",
    );
    assert.equal(days[0].completed, true);
    assert.equal(days[0].calendarDate, "2026-08-18");
    assert.equal(days[1].completed, false);
  });

  it("marks a missed day caught up without completing today", () => {
    const tue = stub({
      iso: "W1D2",
      calendarDate: "2026-08-18",
      workoutId: "w-upper",
      daysFromToday: -3,
    });
    const fri = stub({
      iso: "W1D5",
      calendarDate: "2026-08-21",
      workoutId: "w-lower",
      daysFromToday: 0,
      phase: "today",
    });
    assert.equal(
      dayWorkoutCompleted(tue, new Set(), new Set(), "2026-08-21", new Set(["2026-08-18"])),
      true,
    );
    assert.equal(
      dayWorkoutCompleted(fri, new Set(), new Set(), "2026-08-21", new Set(["2026-08-18"])),
      false,
    );
  });
});
