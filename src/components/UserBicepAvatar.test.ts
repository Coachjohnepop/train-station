import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bicepBadgeValue } from "./UserBicepAvatar";

describe("bicepBadgeValue", () => {
  it("hides a zero so the arm stays a bicep", () => {
    assert.equal(bicepBadgeValue(0, false), null);
    assert.equal(bicepBadgeValue(null, false), null);
  });

  it("shows a purple dot when measurements are due and count is 0", () => {
    assert.equal(bicepBadgeValue(0, true), "dot");
  });

  it("shows the check-in count when there is one", () => {
    assert.equal(bicepBadgeValue(5, false), 5);
    assert.equal(bicepBadgeValue(5, true), 5);
  });
});
