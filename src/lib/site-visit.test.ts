import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finishedSetupThisVisit, isFirstTimeOnSite, isSiteSeenCookie } from "./site-visit";

describe("first time on the site", () => {
  it("is a first visit when no seen cookie exists", () => {
    assert.equal(isFirstTimeOnSite(undefined), true);
    assert.equal(isFirstTimeOnSite(null), true);
    assert.equal(isFirstTimeOnSite(""), true);
  });

  it("is not a first visit after the browser has been here", () => {
    assert.equal(isSiteSeenCookie("1"), true);
    assert.equal(isFirstTimeOnSite("1"), false);
  });

  it("treats a just-finished setup as still this visit", () => {
    assert.equal(finishedSetupThisVisit(new Date().toISOString()), true);
    assert.equal(finishedSetupThisVisit("2020-01-01T00:00:00.000Z"), false);
    assert.equal(finishedSetupThisVisit(null), false);
  });
});
