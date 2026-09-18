import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { platformFeesTotalCents, splitVisibleCash } from "./money-desk-split";

describe("money-desk-split", () => {
  it("defaults to $85 platform fees", () => {
    assert.equal(
      platformFeesTotalCents({
        grokCents: 3000,
        vercelCents: 2000,
        supabaseCents: 3500,
        refundBufferCents: 5000,
        reinvestPercent: 100,
      }),
      8500,
    );
  });

  it("holds leftover in Reinvest when percent is 100", () => {
    const s = splitVisibleCash({
      faCents: 8052,
      availableCents: -20,
      pendingCents: 2397,
      grokCents: 3000,
      vercelCents: 2000,
      supabaseCents: 3500,
      refundBufferCents: 5000,
      johnPayCents: 0,
      reinvestPercent: 100,
    });
    assert.equal(s.visibleCents, 8052 + 2397);
    assert.equal(s.platformFeesCents, 8500);
    assert.equal(s.johnPayCents, 0);
    assert.equal(s.jeremyPayCents, 0);
    assert.equal(s.reinvestCents, s.visibleCents - 8500);
    assert.equal(s.buckets.map((b) => b.id).join(","), "platform_fees,john_pay,reinvest,jeremy_pay");
  });

  it("does not let John Pay starve platform fees", () => {
    const s = splitVisibleCash({
      faCents: 0,
      availableCents: 10000,
      pendingCents: 0,
      grokCents: 3000,
      vercelCents: 2000,
      supabaseCents: 3500,
      refundBufferCents: 5000,
      johnPayCents: 50000,
      reinvestPercent: 0,
    });
    assert.equal(s.platformFeesCents, 8500);
    assert.equal(s.johnPayCents, 1500);
    assert.equal(s.jeremyPayCents, 0);
  });

  it("splits leftover between Reinvest and Jeremy Pay", () => {
    const s = splitVisibleCash({
      faCents: 0,
      availableCents: 20000,
      pendingCents: 0,
      grokCents: 3000,
      vercelCents: 2000,
      supabaseCents: 3500,
      refundBufferCents: 5000,
      johnPayCents: 1500,
      reinvestPercent: 40,
    });
    // leftover = 20000 - 8500 - 1500 = 10000 → 40% reinvest, 60% jeremy
    assert.equal(s.leftoverCents, 10000);
    assert.equal(s.reinvestCents, 4000);
    assert.equal(s.jeremyPayCents, 6000);
  });
});
