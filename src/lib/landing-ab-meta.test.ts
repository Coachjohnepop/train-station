import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANDING_AB_LIVE, LANDING_AB_META } from "./landing-ab";

describe("landing A/B letters", () => {
  it("maps A=tour and B=get started as the live split", () => {
    assert.equal(LANDING_AB_META.tour.letter, "A");
    assert.equal(LANDING_AB_META.jeremy.letter, "B");
    assert.equal(LANDING_AB_META.floor.letter, "C");
    assert.equal(LANDING_AB_META.class.letter, "D");
    assert.deepEqual([...LANDING_AB_LIVE], ["tour", "jeremy"]);
    assert.equal(LANDING_AB_META.tour.status, "live");
    assert.equal(LANDING_AB_META.jeremy.status, "live");
    assert.equal(LANDING_AB_META.jeremy.name, "Get started");
    assert.equal(LANDING_AB_META.class.status, "preview");
  });
});
