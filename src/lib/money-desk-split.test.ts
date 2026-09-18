import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateByPercents,
  BUCKET_RAILS,
  EVEN_SPLIT_PERCENTS,
  outflowThresholdCents,
  platformFeesTotalCents,
  splitVisibleCash,
} from "./money-desk-split";

const lines = {
  grokCents: 3000,
  vercelCents: 2000,
  supabaseCents: 3500,
  refundBufferCents: 5000,
  ...EVEN_SPLIT_PERCENTS,
};

describe("money-desk-split", () => {
  it("still lists $85 monthly platform-fee lines", () => {
    assert.equal(platformFeesTotalCents(lines), 8500);
  });

  it("even 25% split of visible cash sums exactly", () => {
    const s = splitVisibleCash({
      ...lines,
      faCents: 8052,
      availableCents: -20,
      pendingCents: 2397,
    });
    const visible = 8052 + 2397;
    assert.equal(s.visibleCents, visible);
    assert.equal(
      s.platformFeesCents + s.johnPayCents + s.reinvestCents + s.jeremyPayCents,
      visible,
    );
    assert.equal(s.platformFeesPercent, 25);
    assert.equal(s.johnPayPercent, 25);
    assert.equal(s.reinvestPercent, 25);
    assert.equal(s.jeremyPayPercent, 25);
    // 10449 / 4 = 2612.25 → round first three, remainder on Jeremy
    const parts = allocateByPercents(visible, EVEN_SPLIT_PERCENTS);
    assert.equal(s.platformFeesCents, parts.platformFeesCents);
    assert.equal(s.jeremyPayCents, parts.jeremyPayCents);
  });

  it("odd cents land on Jeremy Pay so the four buckets sum", () => {
    const parts = allocateByPercents(100, EVEN_SPLIT_PERCENTS);
    assert.equal(parts.platformFeesCents, 25);
    assert.equal(parts.johnPayCents, 25);
    assert.equal(parts.reinvestCents, 25);
    assert.equal(parts.jeremyPayCents, 25);
    const odd = allocateByPercents(101, EVEN_SPLIT_PERCENTS);
    assert.equal(odd.platformFeesCents + odd.johnPayCents + odd.reinvestCents + odd.jeremyPayCents, 101);
    assert.equal(odd.jeremyPayCents, 101 - odd.platformFeesCents - odd.johnPayCents - odd.reinvestCents);
  });

  it("routes Platform + John to John's Stripe (hold), Reinvest to TS Mercury (hold), Jeremy to mapped Stripe", () => {
    assert.equal(BUCKET_RAILS.platform_fees.id, "john_stripe");
    assert.equal(BUCKET_RAILS.john_pay.id, "john_stripe");
    assert.equal(BUCKET_RAILS.platform_fees.hold, true);
    assert.equal(BUCKET_RAILS.john_pay.hold, true);
    assert.equal(BUCKET_RAILS.reinvest.id, "ts_mercury");
    assert.equal(BUCKET_RAILS.reinvest.hold, true);
    assert.equal(BUCKET_RAILS.jeremy_pay.id, "jeremy_stripe_mapped");
    assert.equal(BUCKET_RAILS.jeremy_pay.hold, false);
    const s = splitVisibleCash({
      ...lines,
      faCents: 10000,
      availableCents: 0,
      pendingCents: 0,
    });
    const byId = Object.fromEntries(s.buckets.map((b) => [b.id, b]));
    assert.equal(byId.platform_fees.rail.id, "john_stripe");
    assert.equal(byId.john_pay.rail.id, "john_stripe");
    assert.equal(byId.reinvest.rail.id, "ts_mercury");
    assert.equal(byId.jeremy_pay.rail.id, "jeremy_stripe_mapped");
  });

  it("outflow threshold is monthly bills × 4 at 25%", () => {
    assert.equal(outflowThresholdCents(8500, 25), 34000);
    const below = splitVisibleCash({
      ...lines,
      faCents: 8052,
      availableCents: 0,
      pendingCents: 2397,
    });
    assert.equal(below.monthlyBillsCents, 8500);
    assert.equal(below.outflowThresholdCents, 34000);
    assert.equal(below.outflowReady, false);
    assert.ok(below.shortfallCents > 0);
    const at = splitVisibleCash({
      ...lines,
      faCents: 34000,
      availableCents: 0,
      pendingCents: 0,
    });
    assert.equal(at.outflowReady, true);
    assert.equal(at.shortfallCents, 0);
    assert.equal(at.platformFeesCents, 8500);
  });
});
