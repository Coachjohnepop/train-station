import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recipientsAfterQuietPolicy } from "./email-quiet-policy";

describe("recipientsAfterQuietPolicy", () => {
  it("drops workout mail for members and both coaches", () => {
    const member = recipientsAfterQuietPolicy(
      "thuggybearcares@gmail.com",
      "workout-complete",
    );
    assert.deepEqual(member.recipients, []);
    assert.equal(member.stoppedForEveryone, true);

    const coaches = recipientsAfterQuietPolicy(
      ["jeremy@thetrainstation.co", "john@thetrainstation.co"],
      "coach-workoutLogged",
    );
    assert.deepEqual(coaches.recipients, []);
    assert.equal(coaches.stoppedForEveryone, true);

    const warmup = recipientsAfterQuietPolicy(
      "jeremy@thetrainstation.co",
      "coach-warmupStarted",
    );
    assert.equal(warmup.stoppedForEveryone, true);
  });

  it("keeps John on a new signup and a reset he asked for", () => {
    const signup = recipientsAfterQuietPolicy(
      "jeremy@thetrainstation.co, john@thetrainstation.co",
      "coach-newMember",
    );
    assert.deepEqual(signup.recipients, [
      "jeremy@thetrainstation.co",
      "john@thetrainstation.co",
    ]);

    const lead = recipientsAfterQuietPolicy(
      ["john@lemonvoice.com"],
      "lead",
    );
    assert.deepEqual(lead.recipients, ["john@lemonvoice.com"]);

    const reset = recipientsAfterQuietPolicy(
      "John <john@lemonvoice.com>",
      "password-reset",
    );
    assert.deepEqual(reset.recipients, ["john@lemonvoice.com"]);
  });

  it("takes John off paid, intro, and coach-message mail", () => {
    const paid = recipientsAfterQuietPolicy(
      ["jeremy@thetrainstation.co", "john@thetrainstation.co", "john@bcxvoice.com"],
      "coach-memberPaid",
    );
    assert.deepEqual(paid.recipients, ["jeremy@thetrainstation.co"]);
    assert.equal(paid.stoppedForEveryone, false);

    const hub = recipientsAfterQuietPolicy(
      "john@lemonvoice.com",
      "message-hub",
    );
    assert.deepEqual(hub.recipients, []);

    const memberWelcome = recipientsAfterQuietPolicy(
      "aiden102206@icloud.com",
      "welcome-signup",
    );
    assert.deepEqual(memberWelcome.recipients, ["aiden102206@icloud.com"]);
  });
});
