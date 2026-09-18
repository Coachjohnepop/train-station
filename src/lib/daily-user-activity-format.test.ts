import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDays,
  countCompletedSets,
  friendlyPath,
  headlinesFromFacts,
  pacificDayBounds,
  sortActiveUsers,
  yesterdayIso,
  type DailyUserActivity,
  type UserActivityFacts,
} from "./daily-user-activity-format";

function facts(partial: Partial<UserActivityFacts> = {}): UserActivityFacts {
  return {
    userId: "u1",
    name: "Ali",
    email: "ali@example.com",
    role: "MEMBER",
    plan: "member",
    planLabel: "Coach Class",
    memberHref: "/admin/members/u1",
    firstSeenAt: "2026-09-17T14:00:00.000Z",
    lastSeenAt: "2026-09-17T15:00:00.000Z",
    workouts: [],
    classAssigned: null,
    classPosted: null,
    setsChecked: 0,
    exercisesFinished: 0,
    joinedZoom: false,
    startedZoom: false,
    messagesSent: 0,
    messagesReceived: 0,
    bookings: [],
    measurements: 0,
    payments: [],
    signedUp: false,
    pages: [],
    timeline: [],
    device: "mobile",
    coachEdits: [],
    ...partial,
  };
}

describe("pacificDayBounds", () => {
  it("uses PDT midnight for mid-September", () => {
    const { start, end } = pacificDayBounds("2026-09-17");
    assert.equal(start.toISOString(), "2026-09-17T07:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-18T07:00:00.000Z");
  });

  it("uses PST midnight in January", () => {
    const { start } = pacificDayBounds("2026-01-15");
    assert.equal(start.toISOString(), "2026-01-15T08:00:00.000Z");
  });
});

describe("yesterdayIso", () => {
  it("is the previous PT calendar day", () => {
    const thursdayMorningPt = new Date("2026-09-18T14:00:00.000Z"); // 7am PT
    assert.equal(yesterdayIso(thursdayMorningPt), "2026-09-17");
  });
});

describe("addCalendarDays", () => {
  it("crosses months", () => {
    assert.equal(addCalendarDays("2026-09-01", -1), "2026-08-31");
  });
});

describe("friendlyPath", () => {
  it("names member Today and tickets", () => {
    assert.equal(friendlyPath("/member/today"), "Today");
    assert.equal(friendlyPath("/join#tickets"), "Tickets");
  });
});

describe("countCompletedSets", () => {
  it("sums set arrays per exercise", () => {
    assert.equal(countCompletedSets({ a: [1, 2], b: [3] }), 3);
  });
});

describe("headlinesFromFacts", () => {
  it("leads with workout and set checks", () => {
    const lines = headlinesFromFacts(
      facts({
        workouts: [{ name: "Leg day", completed: true, progress: 100 }],
        setsChecked: 8,
        exercisesFinished: 4,
        joinedZoom: true,
      }),
    );
    assert.equal(lines[0], "Logged Leg day");
    assert.ok(lines.some((l) => l.includes("Checked 8 sets")));
    assert.ok(lines.includes("Joined live Zoom"));
  });

  it("collapses repeat logs of the same workout", () => {
    const lines = headlinesFromFacts(
      facts({
        workouts: [
          { name: "Lower Body Workout", completed: true, progress: 100 },
          { name: "Lower Body Workout", completed: true, progress: 100 },
          { name: "Lower Body Workout", completed: true, progress: 100 },
        ],
      }),
    );
    assert.equal(lines[0], "Logged Lower Body Workout (×3)");
  });
});

describe("sortActiveUsers", () => {
  it("puts people who trained ahead of staff browsing", () => {
    const trained = {
      userId: "m",
      role: "MEMBER",
      workouts: [{ name: "Leg", completed: true, progress: 100 }],
      setsChecked: 2,
      lastSeenAt: "2026-09-17T12:00:00.000Z",
    } as DailyUserActivity;
    const coach = {
      userId: "c",
      role: "INSTRUCTOR",
      workouts: [],
      setsChecked: 0,
      lastSeenAt: "2026-09-17T20:00:00.000Z",
    } as DailyUserActivity;
    const sorted = sortActiveUsers([coach, trained]);
    assert.equal(sorted[0].userId, "m");
  });
});
