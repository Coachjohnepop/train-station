import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFoodTrackDashboard, FOOD_TRACK_DAYS_PER_CYCLE } from "./food-track";

describe("food track cycle", () => {
  it("asks for two completed days and lights weekdays that were sampled", () => {
    const dash = buildFoodTrackDashboard({
      todayIso: "2026-10-03",
      days: [
        {
          eatenOn: "2026-09-15",
          startedAt: "2026-09-15T12:00:00.000Z",
          completedAt: "2026-09-16T02:00:00.000Z",
          calories: 2100,
          entryCount: 6,
        },
        {
          eatenOn: "2026-10-03",
          startedAt: "2026-10-03T14:00:00.000Z",
          completedAt: null,
          calories: 800,
          entryCount: 2,
        },
      ],
    });
    assert.equal(FOOD_TRACK_DAYS_PER_CYCLE, 2);
    assert.equal(dash.goal, 2);
    assert.equal(dash.completedCount, 1);
    assert.equal(dash.remaining, 1);
    assert.equal(dash.todayStarted, true);
    assert.equal(dash.todayCompleted, false);
    assert.equal(dash.lastTwo[0].eatenOn, "2026-10-03");
    assert.equal(dash.lastTwo[0].weekday, "Sat");
    assert.equal(dash.lastTwo[1].weekday, "Tue");
    const lit = dash.weekdays.filter((d) => d.logged).map((d) => d.name);
    assert.deepEqual(lit, ["Tue", "Sat"]);
  });

  it("treats two completed days as a filled cycle", () => {
    const dash = buildFoodTrackDashboard({
      todayIso: "2026-10-03",
      days: [
        {
          eatenOn: "2026-09-12",
          startedAt: "2026-09-12T12:00:00.000Z",
          completedAt: "2026-09-13T02:00:00.000Z",
          calories: 1800,
          entryCount: 5,
        },
        {
          eatenOn: "2026-09-20",
          startedAt: "2026-09-20T12:00:00.000Z",
          completedAt: "2026-09-21T01:00:00.000Z",
          calories: 2400,
          entryCount: 7,
        },
      ],
    });
    assert.equal(dash.remaining, 0);
    assert.equal(dash.todayStarted, false);
    assert.deepEqual(
      dash.weekdays.filter((d) => d.logged).map((d) => d.name),
      ["Sat", "Sun"],
    );
  });
});
