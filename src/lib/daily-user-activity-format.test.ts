import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDays,
  countCompletedSets,
  friendlyPath,
  headlinesFromFacts,
  pacificDayBounds,
  parseUsageRange,
  shiftUsageDate,
  sortActiveUsers,
  usageWindow,
  weekStartIso,
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

describe("usageWindow", () => {
  it("weeks start Monday", () => {
    assert.equal(weekStartIso("2026-09-17"), "2026-09-14");
    const w = usageWindow("week", "2026-09-17");
    assert.equal(w.startIso, "2026-09-14");
    assert.equal(w.endIsoExclusive, "2026-09-21");
  });

  it("months are calendar months", () => {
    const m = usageWindow("month", "2026-09-18");
    assert.equal(m.startIso, "2026-09-01");
    assert.equal(m.endIsoExclusive, "2026-10-01");
    assert.equal(m.label, "September 2026");
  });

  it("shifts by the selected range", () => {
    assert.equal(shiftUsageDate("2026-09-18", "day", -1), "2026-09-17");
    assert.equal(shiftUsageDate("2026-09-18", "week", -1), "2026-09-11");
    assert.equal(shiftUsageDate("2026-09-18", "month", -1), "2026-08-18");
    assert.equal(parseUsageRange("WEEK"), "week");
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
    } as unknown as DailyUserActivity;
    const coach = {
      userId: "c",
      role: "INSTRUCTOR",
      workouts: [],
      setsChecked: 0,
      lastSeenAt: "2026-09-17T20:00:00.000Z",
    } as unknown as DailyUserActivity;
    const sorted = sortActiveUsers([coach, trained]);
    assert.equal(sorted[0].userId, "m");
  });
});
