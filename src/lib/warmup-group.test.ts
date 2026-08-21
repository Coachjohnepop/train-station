import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCanonicalWarmupName,
  isStandardWarmupWorkoutId,
  STANDARD_WARMUP_WORKOUT_ID,
  workoutHasStandardWarmup,
} from "./warmup-template";
import {
  expandParsedWarmupExercises,
  isWarmupMovementDone,
  isWarmupWorkoutLine,
  leadingWarmupCount,
  normalizeWarmupRestSeconds,
  parseWarmupNoteMovements,
  resolveWarmupGroup,
  shortWarmupLabel,
  withWarmupBlockNote,
  type ExpandableWarmupExercise,
} from "./warmup-group";

describe("leadingWarmupCount", () => {
  it("groups tagged warm-up lines including jump squats", () => {
    const n = leadingWarmupCount([
      { name: "Bike", notes: "Warm-up block" },
      { name: "Band Exercises", notes: "Warm-up block" },
      { name: "Jump Squats", notes: "Warm-up block" },
      { name: "Leg Press Machine", notes: null },
    ]);
    assert.equal(n, 3);
  });

  it("treats a lone Warm-up note tag as a warmup line", () => {
    assert.ok(isWarmupWorkoutLine({ name: "Bike", notes: "Warm-up" }));
    assert.equal(
      isWarmupWorkoutLine({
        name: "Leg Press Machine",
        notes: "do this after warm-up",
      }),
      false,
    );
  });

  it("stops before a main lift even if the name has band", () => {
    const n = leadingWarmupCount([
      { name: "General Warm Up + Shoulder Mobility", notes: null },
      { name: "Band Lat Pulldown", notes: null },
    ]);
    assert.equal(n, 1);
  });

  it("treats 15 as the default rest", () => {
    assert.equal(normalizeWarmupRestSeconds(undefined), 15);
    assert.equal(normalizeWarmupRestSeconds(15), 15);
    assert.equal(normalizeWarmupRestSeconds(8), 8);
  });

  it("labels set buttons with words", () => {
    assert.equal(shortWarmupLabel("Warm up well 5 min bike"), "Bike");
    assert.equal(shortWarmupLabel("Band Exercises"), "Band Exercises");
    assert.ok(isWarmupWorkoutLine({ name: "Bike", notes: "Warm-up block" }));
  });
});

describe("parseWarmupNoteMovements", () => {
  it("expands Jeremy's standard live-class blob into named moves", () => {
    const lines = parseWarmupNoteMovements(`Warm-up (bonus points if done before coach arrives)
5 min bike, row, or brisk walk
Wall taps 20
Band pull-aparts 15
Lightweight bicep curls 15
Light shoulder press 15
Shrugs 15
Bosu ball squats 10
Jump squats 10
 · Warm-up block`);
    assert.equal(lines[0]?.timed, true);
    assert.equal(lines[0]?.holdSeconds, 300);
    assert.match(lines[0]?.name || "", /bike|row|walk/i);
    assert.equal(lines.length, 8);
    assert.ok(lines.some((l) => /jump squat/i.test(l.name)));
    assert.ok(lines.some((l) => l.name.toLowerCase().includes("wall tap")));
  });
});

describe("resolveWarmupGroup", () => {
  it("collapses leading tagged rows without rewriting them", () => {
    const group = resolveWarmupGroup([
      { id: "a", name: "Bike", notes: "Warm-up block", setScheme: "timed", reps: "5 min", setCount: 1 },
      { id: "b", name: "Jump Squats", notes: "Warm-up block", setScheme: "standard", reps: "10", setCount: 1 },
      { id: "c", name: "Leg Press Machine", notes: null, setScheme: "standard", setCount: 3 },
    ]);
    assert.equal(group.mode, "rows");
    assert.equal(group.leadCount, 2);
    assert.equal(group.movements[0]?.blockId, "a");
    assert.equal(group.movements[1]?.blockId, "b");
    assert.equal(group.movements[0]?.label.toLowerCase(), "bike");
  });

  it("expands a single SMS Warm-up blob into word-buttons", () => {
    const group = resolveWarmupGroup([
      {
        id: "wu",
        name: "Warm-up",
        notes: "5 min bike\nWall taps 20\nJump squats 10\nWarm-up block",
        setScheme: "standard",
        setCount: 1,
      },
      { id: "main", name: "Leg Press Machine", notes: null, setCount: 3 },
    ]);
    assert.equal(group.mode, "notes");
    assert.equal(group.leadCount, 1);
    assert.equal(group.parentId, "wu");
    assert.equal(group.movements.length, 3);
    assert.deepEqual(
      group.movements.map((m) => m.setNum),
      [1, 2, 3],
    );
    assert.ok(group.movements.every((m) => m.blockId === "wu"));
  });

  it("does not treat a later band lift as a warm-up set", () => {
    const group = resolveWarmupGroup([
      { id: "wu", name: "General Warm Up + Shoulder Mobility", notes: null },
      { id: "lat", name: "Band Lat Pulldown", notes: null },
    ]);
    assert.equal(group.leadCount, 1);
    assert.equal(group.movements.length, 1);
  });

  it("tracks notes-mode sets independently", () => {
    const group = resolveWarmupGroup([
      {
        id: "wu",
        name: "Warm-up",
        notes: "Bike\nBands\nJump squats",
      },
    ]);
    const [bike, bands] = group.movements;
    assert.ok(bike && bands);
    const finished = new Set<string>();
    const completed = { wu: new Set([1]) };
    assert.equal(isWarmupMovementDone(bike, finished, completed), true);
    assert.equal(isWarmupMovementDone(bands, finished, completed), false);
  });
});

describe("standard warmup workout id", () => {
  it("is a stable catalog id", () => {
    assert.equal(STANDARD_WARMUP_WORKOUT_ID, "warmup-standard");
    assert.equal(isStandardWarmupWorkoutId("warmup-standard"), true);
    assert.equal(isStandardWarmupWorkoutId("sms-w-1"), false);
  });

  it("does not treat a coach section like Better for back as the agreed warm-up", () => {
    assert.equal(isCanonicalWarmupName("Better for back"), false);
    assert.equal(isCanonicalWarmupName("Step Back Lunge with a Forward Kick"), false);
    assert.equal(isCanonicalWarmupName("Warm up well 5-7 min"), true);
    assert.equal(
      workoutHasStandardWarmup(["Better for back", "Dumbbell Flat Bench Chest Press"]),
      false,
    );
    assert.equal(
      workoutHasStandardWarmup(["Warm up well 5-7 min", "Dumbbell Flat Bench Chest Press"]),
      true,
    );
  });
});

describe("expandParsedWarmupExercises", () => {
  it("writes one persistable row per warm-up movement", () => {
    const expanded = expandParsedWarmupExercises<ExpandableWarmupExercise>([
      {
        name: "Warm-up",
        sets: 1,
        reps: "—",
        notes: "5 min bike\nWall taps 20\nJump squats 10",
        section: "warmup",
        setScheme: "standard",
      },
      { name: "Leg Press Machine", sets: 3, reps: "10", section: "main" },
    ]);
    assert.equal(expanded.length, 4);
    assert.equal(expanded[0]?.section, "warmup");
    assert.equal(expanded[0]?.setScheme, "timed");
    assert.ok(/bike/i.test(expanded[0]?.name || ""));
    assert.ok(/wall tap/i.test(expanded[1]?.name || ""));
    assert.ok(/jump squat/i.test(expanded[2]?.name || ""));
    assert.equal(expanded[3]?.name, "Leg Press Machine");
  });

  it("keeps the Warm-up block tag without wiping other notes", () => {
    assert.equal(withWarmupBlockNote("Each arm", true), "Each arm · Warm-up block");
    assert.equal(withWarmupBlockNote("Each arm · Warm-up block", false), "Each arm");
  });
});
