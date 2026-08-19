import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextNewbieHref } from "./newbie-step";

describe("nextNewbieHref", () => {
  it("sends unpaid Coach Class to checkout, not the wizard", () => {
    assert.equal(
      nextNewbieHref({
        plan: "member",
        onboardingComplete: false,
        paymentStatus: "pending",
        needsPayment: true,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/checkout?plan=member",
    );
  });

  it("sends free Explorer to the wizard", () => {
    assert.equal(
      nextNewbieHref({
        plan: "explorer",
        onboardingComplete: false,
        paymentStatus: "none",
        needsPayment: false,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/onboard?plan=explorer",
    );
  });

  it("lands finished members on Today, not /member", () => {
    assert.equal(
      nextNewbieHref({
        plan: "member",
        onboardingComplete: true,
        paymentStatus: "paid",
        needsPayment: false,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/today",
    );
  });

  it("keeps speaking and custom quotes off the membership wizard", () => {
    assert.equal(
      nextNewbieHref({
        plan: "speaking_fee",
        onboardingComplete: false,
        needsPayment: false,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/speaking",
    );
    assert.equal(
      nextNewbieHref({
        plan: "custom_training",
        onboardingComplete: false,
        needsPayment: false,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/quote-received?plan=custom_training",
    );
  });

  it("sends paid re-onboard back through checkout to prove coverage", () => {
    assert.equal(
      nextNewbieHref({
        plan: "member",
        onboardingComplete: false,
        paymentStatus: "paid",
        needsPayment: false,
        needsFreePm: false,
        needsApproval: false,
        needsFirstTape: false,
      }),
      "/member/checkout?plan=member",
    );
  });
});
