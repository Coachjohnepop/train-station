import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFreeExplorerPlan } from "./free-tier-product";
import { normalizeSignupPlan } from "./signup-plans";

describe("paid tickets are not Free Explorer", () => {
  it("keeps Business Class above the Coach Class upgrade gate", () => {
    assert.equal(normalizeSignupPlan("business"), "business");
    assert.equal(normalizeSignupPlan("Business Class"), "business");
    assert.equal(isFreeExplorerPlan("business"), false);
    assert.equal(isFreeExplorerPlan("Business Class"), false);
    assert.equal(isFreeExplorerPlan("pro"), false);
    assert.equal(isFreeExplorerPlan("member"), false);
    assert.equal(isFreeExplorerPlan("explorer"), true);
    assert.equal(isFreeExplorerPlan(null), false);
  });
});
