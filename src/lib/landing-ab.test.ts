import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLandingAbVariant, resolveLiveLandingAb } from "./landing-ab";

describe("parseLandingAbVariant", () => {
  it("maps aliases", () => {
    assert.equal(parseLandingAbVariant("tour"), "tour");
    assert.equal(parseLandingAbVariant("A"), "tour");
    assert.equal(parseLandingAbVariant("jeremy"), "jeremy");
    assert.equal(parseLandingAbVariant("b"), "jeremy");
    assert.equal(parseLandingAbVariant("floor"), "floor");
    assert.equal(parseLandingAbVariant("C"), "floor");
  });

  it("rejects junk", () => {
    assert.equal(parseLandingAbVariant(""), null);
    assert.equal(parseLandingAbVariant("landing1"), null);
    assert.equal(parseLandingAbVariant(undefined), null);
  });
});

describe("resolveLiveLandingAb", () => {
  it("keeps a live sticky arm", () => {
    assert.equal(resolveLiveLandingAb("tour"), "tour");
    assert.equal(resolveLiveLandingAb("jeremy"), "jeremy");
  });

  it("keeps a preview C cookie sticky (does not re-roll A/B)", () => {
    assert.equal(resolveLiveLandingAb("floor"), "floor");
  });
});

