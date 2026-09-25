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

  it("keeps the chest and tricep SMS as separate lifts", () => {
    const parsed = parseSmsWorkout(`Chest tricep power

Warm up well
Same as usual
7 mins bike/jog

Upper body warm up
Curls 20
Shoulder press 20
Shoulder mobility bands warm up 30/30

1 min 30 sec rests

Flat bench Dumbbell chest press
2 count rest pause
7 count positives
10,10,10,10

Incline dumbbell chest press
4 sets 10 reps
Bench at 40 degrees incline
2 count rest pause
7 count positives
10,10,10,10

Seated Chest Fly machine
Bring pinkies together on squeeze
2 count squeeze
10,10,10,10

Overhead Rope
cable tricep extensions.
10,10,10,10

Single arm dumbbell tricep extensions
Hand on elbow
2 count rest pause
7 count positives
10,10,10, 10

Burnout push-ups
1 set

5 min HIIT cooldown
20 sec intervals

Stretch
`);
    assert.equal(parsed.title, "Chest tricep power");

    const incline = parsed.exercises.find((e) => /incline dumbbell chest press/i.test(e.name));
    assert.ok(incline);
    assert.equal(incline?.section, "main");
    assert.equal(incline?.sets, 4);
    assert.equal(incline?.reps, "10,10,10,10");
    assert.match(String(incline?.notes), /bench at 40 degrees incline/i);
    assert.match(String(incline?.notes), /2 count rest pause/i);
    assert.equal(
      parsed.exercises.some((e) => /bench at 40/i.test(e.name)),
      false,
    );

    const fly = parsed.exercises.find((e) => /chest fly/i.test(e.name));
    assert.ok(fly);
    assert.equal(fly?.reps, "10,10,10,10");
    assert.doesNotMatch(String(fly?.notes || ""), /overhead rope/i);

    const rope = parsed.exercises.find((e) => /overhead rope cable tricep/i.test(e.name));
    assert.ok(rope);
    assert.equal(rope?.reps, "10,10,10,10");

    const hiit = parsed.exercises.find((e) => /hiit cooldown/i.test(e.name));
    assert.ok(hiit);
    assert.equal(hiit?.section, "cooldown");
    assert.equal(hiit?.setScheme, "timed");
    assert.match(String(hiit?.reps), /5 min/);
    assert.match(String(hiit?.notes), /20 sec/);

    const stretch = parsed.exercises.find((e) => /^stretch$/i.test(e.name));
    assert.ok(stretch);
    assert.equal(stretch?.section, "cooldown");

    assert.ok(parsed.exercises.some((e) => e.section === "warmup" && /curl/i.test(e.name)));
    assert.ok(
      parsed.exercises.some((e) => e.section === "warmup" && /shoulder press/i.test(e.name)),
    );
  });
});
