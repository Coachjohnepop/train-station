import assert from "node:assert/strict";
import test from "node:test";
import { estimateActivityBurn, estimateSessionBurn, estimateWorkoutBurn, metCalories } from "./burn-estimate";

test("hilly nine-hole walk is about 800 calories at 179 lb", () => {
  const burned = estimateActivityBurn(
    "Walked nine holes of golf at Rancho Murieta North course which is quite hilly",
    179,
  );
  assert.ok(burned != null && burned >= 750 && burned <= 900);
});

test("wheelbarrow loads are a short hard effort", () => {
  const burned = estimateActivityBurn("moved 10 full loads of dirt in wheel barrow 100 feet", 179);
  assert.ok(burned != null && burned >= 150 && burned <= 280);
});

test("five hours of snow skiing is a large burn", () => {
  const burned = estimateActivityBurn("snow skiing for 5 hours", 179);
  assert.ok(burned != null && burned >= 2000 && burned <= 2800);
});

test("a two hour zoo walk is a few hundred calories", () => {
  const burned = estimateActivityBurn("walked around sacramento zoo for 2 hours", 179);
  assert.ok(burned != null && burned >= 450 && burned <= 600);
});

test("an hour of ice skating is a moderate burn", () => {
  const burned = estimateActivityBurn("ice skating for 1 hour", 179);
  assert.ok(burned != null && burned >= 500 && burned <= 700);
});

test("a named 35 minute fasted cardio uses that duration once", () => {
  const burned = estimateSessionBurn({
    name: "35 Minutes of Fasted Cardio",
    weightLbs: 179,
    pieces: [
      { name: "Fasted Cardio", sets: 1 },
      { name: "Fasted Cardio", sets: 1 },
    ],
  });
  assert.ok(burned >= 220 && burned <= 340);
});

test("strength pieces add up instead of a flat 20 minutes", () => {
  const burned = estimateSessionBurn({
    name: "Lower body",
    weightLbs: 179,
    pieces: [
      { name: "Goblet Squat", sets: 4, reps: "12" },
      { name: "Romanian Dead Lift", sets: 4, reps: "8" },
      { name: "Walking Lunges", sets: 3, reps: "16" },
      { name: "Cool Down & Stretch", sets: 1, reps: "5 mins" },
    ],
  });
  assert.ok(burned >= 180 && burned <= 550);
});

test("strength session uses body weight and minutes", () => {
  const burned = estimateWorkoutBurn({ name: "Lower body", weightLbs: 179, minutes: 45 });
  assert.equal(burned, metCalories(5, 179, 0.75));
});
