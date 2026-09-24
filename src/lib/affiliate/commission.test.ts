import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCommissionRate,
  commissionCents,
} from "./commission";

test("discount and commission split the 20% pool", () => {
  assert.equal(calculateCommissionRate(0), 0.2);
  assert.equal(calculateCommissionRate(0.05), 0.15);
  assert.equal(calculateCommissionRate(0.1), 0.1);
  assert.equal(calculateCommissionRate(0.15), 0.05);
  assert.equal(calculateCommissionRate(0.2), 0.05);
  assert.equal(calculateCommissionRate(0.4), 0);
  assert.equal(calculateCommissionRate(0.5), 0);
});

test("commission is rounded cents on the charged amount", () => {
  assert.equal(commissionCents(2500, 0.2), 500);
  assert.equal(commissionCents(2500, 0.1), 250);
  assert.equal(commissionCents(0, 0.2), 0);
});
