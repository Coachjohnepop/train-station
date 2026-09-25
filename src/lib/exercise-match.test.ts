import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchExerciseInCatalog, type ExerciseCatalogEntry } from "./exercise-match";

const catalog: ExerciseCatalogEntry[] = [
  { id: "row", name: "Seated Back Row Machine" },
  { id: "fly", name: "Machine Chest Flies" },
  { id: "band-fly", name: "Chest Flies-Resistance Band" },
  { id: "incline-fly", name: "Incline Bench, Dumbbell Chest Fly" },
  { id: "straight", name: "Standing Straight Bar Cable Tricep Extensions" },
  { id: "rope", name: "Standing Cable Rope Triceps Extensions" },
  { id: "press", name: "Incline Dumbbell Chest Press" },
];

describe("matchExerciseInCatalog SMS names", () => {
  it("matches a seated chest fly to the chest fly machine, not a back row", () => {
    const hit = matchExerciseInCatalog("Seated Chest Fly machine", catalog);
    assert.equal(hit?.id, "fly");
  });

  it("matches overhead rope cable extensions to the rope, not the straight bar", () => {
    const hit = matchExerciseInCatalog("Overhead Rope cable tricep extensions", catalog);
    assert.equal(hit?.id, "rope");
  });

  it("still matches the incline dumbbell press", () => {
    const hit = matchExerciseInCatalog("Incline dumbbell chest press", catalog);
    assert.equal(hit?.id, "press");
  });
});
