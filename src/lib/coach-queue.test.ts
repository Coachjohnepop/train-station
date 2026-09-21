import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCoachQueueNoise } from "./coach-queue-noise";

describe("coach queue noise", () => {
  it("drops guest stubs and house testers", () => {
    assert.equal(
      isCoachQueueNoise({
        email: "guest.guestb876f3f5.84b9-424@guest.thetrainstation.co",
        name: "Guestb876f3f5",
      }),
      true,
    );
    assert.equal(isCoachQueueNoise({ email: "john@lemonvoice.com", name: "Lemon John" }), true);
    assert.equal(
      isCoachQueueNoise({ email: "coachjohnepop@yahoo.com", name: "Coach Ed" }),
      true,
    );
  });

  it("keeps real members", () => {
    assert.equal(
      isCoachQueueNoise({ email: "fletcherboys@att.net", name: "Ali Fletcher" }),
      false,
    );
    assert.equal(isCoachQueueNoise({ email: "chamberszed@gmail.com", name: "Zedek Chambers" }), false);
  });
});
