import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStandingStaffGrantEmail,
  STANDING_STAFF_GRANT_EMAILS,
} from "./staff-grant-standing";

describe("standing staff grant emails", () => {
  it("includes Stephanie and developer John identities", () => {
    for (const email of [
      "sprealty9@gmail.com",
      "fletcherboys@att.net",
      "john@lemonvoice.com",
      "coachjohnepop@yahoo.com",
      "john@thetrainstation.co",
    ]) {
      assert.ok(
        (STANDING_STAFF_GRANT_EMAILS as readonly string[]).includes(email),
        email,
      );
    }
  });

  it("matches emails case-insensitively and ignores blanks", () => {
    assert.equal(isStandingStaffGrantEmail("CoachJohnEPop@yahoo.com"), true);
    assert.equal(isStandingStaffGrantEmail("FletcherBoys@att.net"), true);
    assert.equal(isStandingStaffGrantEmail(" john@lemonvoice.com "), true);
    assert.equal(isStandingStaffGrantEmail(null), false);
    assert.equal(isStandingStaffGrantEmail("jeremy@thetrainstation.co"), false);
  });
});
