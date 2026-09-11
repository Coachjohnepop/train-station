import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyWorkoutItemToPrescriptionDraft } from "./prescription-from-legacy";
import { prescriptionToLegacy } from "./prescription-to-legacy";

describe("HIT prescription load", () => {
  it("treats 20s as matching rest even if leftover restSec is 45", () => {
    const draft = legacyWorkoutItemToPrescriptionDraft(
      {
        setScheme: "hit",
        reps: "20s",
        sets: 10,
        restSec: 45,
        notes: null,
      },
      "Bike sprint",
    );
    assert.equal(draft.patternType, "hit_intervals");
    assert.equal(draft.phase1DurationSec, 20);
    assert.equal(draft.phase2DurationSec, 20);
    const saved = prescriptionToLegacy(draft);
    assert.equal(saved.reps, "20s");
    assert.equal(saved.restSec, 20);
  });

  it("keeps an Admin-set 20/15 split", () => {
    const draft = legacyWorkoutItemToPrescriptionDraft(
      {
        setScheme: "hit",
        reps: "20/15",
        sets: 10,
        restSec: 15,
        notes: null,
      },
      "Bike sprint",
    );
    assert.equal(draft.phase1DurationSec, 20);
    assert.equal(draft.phase2DurationSec, 15);
    assert.equal(prescriptionToLegacy(draft).reps, "20/15");
  });
});
