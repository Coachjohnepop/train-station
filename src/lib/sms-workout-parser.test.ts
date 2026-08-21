import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSmsWorkout } from "./sms-workout-parser";

describe("parseSmsWorkout section headers", () => {
  it("keeps Better for back as a note on the next lift, not a warm-up", () => {
    const parsed = parseSmsWorkout(`Upper Body Workout

Better for back
Step Back Lunge with a Forward Kick

Flat bench dumbbell chest press
12,12,12,12
`);
    const lunge = parsed.exercises.find((e) => /lunge/i.test(e.name));
    const warmup = parsed.exercises.filter((e) => e.section === "warmup");
    assert.ok(lunge);
    assert.equal(lunge?.section, "main");
    assert.match(String(lunge?.notes || ""), /better for back/i);
    assert.equal(warmup.length, 0);
  });

  it("still collects lines after a warm-up header as warm-up", () => {
    const parsed = parseSmsWorkout(`Upper Body Workout

Warm up well 5 min bike

Flat bench dumbbell chest press
12,12,12
`);
    assert.ok(parsed.exercises.some((e) => e.section === "warmup"));
    assert.ok(parsed.exercises.some((e) => /chest press/i.test(e.name) && e.section === "main"));
  });
});
