import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateByPercents,
  EVEN_SPLIT_PERCENTS,
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
});
