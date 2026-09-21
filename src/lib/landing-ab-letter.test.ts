import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  landingAbPath,
  parseLandingAbVariant,
  parseLandingLetterPath,
} from "./landing-ab";

describe("landing A/B letter paths", () => {
  it("maps /a to tour and /b to jeremy", () => {
    assert.equal(parseLandingLetterPath("/a"), "tour");
    assert.equal(parseLandingLetterPath("/A"), "tour");
    assert.equal(parseLandingLetterPath("/b"), "jeremy");
    assert.equal(parseLandingLetterPath("/b/"), "jeremy");
    assert.equal(parseLandingLetterPath("/join"), null);
  });

  it("publishes easy doors at /a and /b", () => {
    assert.equal(landingAbPath("tour"), "/a");
    assert.equal(landingAbPath("jeremy"), "/b");
    assert.equal(landingAbPath("class"), "/l/class");
    assert.equal(parseLandingAbVariant("a"), "tour");
    assert.equal(parseLandingAbVariant("b"), "jeremy");
  });
});
