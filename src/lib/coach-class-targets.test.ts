import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JOHN_STEPH_CLASS_EMAILS,
  memberChipLabel,
  memberIdsForEmails,
} from "./coach-class-targets";

describe("coach-class-targets", () => {
  const roster = [
    { id: "lemon", name: "Lemon John", email: "john@lemonvoice.com" },
    { id: "steph", name: "Stephanie Popham", email: "sprealty9@gmail.com" },
    { id: "bcx", name: "John Popham", email: "john@bcxvoice.com" },
    { id: "todd", name: "Todd Hower", email: "dubl-e@howerfamily.com" },
  ];

  it("resolves the paid couple by email, not demo ids", () => {
    assert.deepEqual(memberIdsForEmails(roster, JOHN_STEPH_CLASS_EMAILS), ["lemon", "steph"]);
  });

  it("ignores missing emails and does not invent members", () => {
    assert.deepEqual(memberIdsForEmails(roster, ["nobody@example.com"]), []);
  });

  it("labels both Johns with email so the coach can tell them apart", () => {
    assert.equal(memberChipLabel(roster[0], roster), "Lemon John · john@lemonvoice.com");
    assert.equal(memberChipLabel(roster[2], roster), "John Popham · john@bcxvoice.com");
    assert.equal(memberChipLabel(roster[3], roster), "Todd Hower");
  });
});
