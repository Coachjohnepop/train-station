import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStaleMemberVsCoachWrite } from "./live-workout-session-merge";

describe("isStaleMemberVsCoachWrite", () => {
  it("treats a member refresh PUT with no baseRevision as stale vs coach", () => {
    assert.equal(
      isStaleMemberVsCoachWrite({
        updatedBy: "member",
        baseRevision: null,
        existingUpdatedBy: "coach",
        existingRevision: 8,
      }),
      true,
    );
  });

  it("treats an older member revision as stale vs newer coach", () => {
    assert.equal(
      isStaleMemberVsCoachWrite({
        updatedBy: "member",
        baseRevision: 6,
        existingUpdatedBy: "coach",
        existingRevision: 8,
      }),
      true,
    );
  });

  it("allows a first member write when there is no coach row", () => {
    assert.equal(
      isStaleMemberVsCoachWrite({
        updatedBy: "member",
        baseRevision: null,
        existingRevision: 0,
      }),
      false,
    );
  });

  it("allows a coach write to replace", () => {
    assert.equal(
      isStaleMemberVsCoachWrite({
        updatedBy: "coach",
        baseRevision: 3,
        existingUpdatedBy: "member",
        existingRevision: 7,
      }),
      false,
    );
  });
});
