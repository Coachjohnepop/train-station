import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkoutShouldSkipAsAlreadyPaid } from "./paid-coverage-skip";

describe("checkout already-paid skip", () => {
  it("does not skip house-paid members who still need a Stripe customer", () => {
    assert.equal(
      checkoutShouldSkipAsAlreadyPaid(
        { ok: true },
        { stripeCustomerId: null },
      ),
      false,
    );
  });

  it("skips only when coverage is real and a Jeremy Live customer exists", () => {
    assert.equal(
      checkoutShouldSkipAsAlreadyPaid(
        { ok: true },
        { stripeCustomerId: "cus_live" },
      ),
      true,
    );
    assert.equal(
      checkoutShouldSkipAsAlreadyPaid(
        { ok: false },
        { stripeCustomerId: null },
      ),
      false,
    );
  });
});
