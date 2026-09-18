import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANDING_AB_LIVE, LANDING_AB_META } from "./landing-ab";

describe("landing A/B letters", () => {
  it("maps A=tour and D=class as the live split", () => {
    assert.equal(LANDING_AB_META.tour.letter, "A");
    assert.equal(LANDING_AB_META.class.letter, "D");
    assert.equal(LANDING_AB_META.jeremy.letter, "B");
    assert.equal(LANDING_AB_META.floor.letter, "C");
    assert.deepEqual([...LANDING_AB_LIVE], ["tour", "class"]);
    assert.equal(LANDING_AB_META.tour.status, "live");
    assert.equal(LANDING_AB_META.class.status, "live");
    assert.equal(LANDING_AB_META.jeremy.status, "retired");
  });
});
