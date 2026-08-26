import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatHitReps,
  formatHitSummary,
  parseHitReps,
  resolveHitInterval,
} from "./hit-intervals";

describe("HIT intervals", () => {
  it("parses 20s as equal work and rest", () => {
    assert.deepEqual(parseHitReps("20s"), { workSec: 20, restSec: 20 });
  });

  it("parses 20/15 as split work and rest", () => {
    assert.deepEqual(parseHitReps("20/15"), { workSec: 20, restSec: 15 });
  });

  it("10 rounds of 20/20 is 20 bouts and 400 seconds", () => {
    const hit = resolveHitInterval({
      setScheme: "hit",
      reps: "20s",
      setCount: 10,
    });
    assert.ok(hit);
    assert.equal(hit.rounds, 10);
    assert.equal(hit.bouts, 20);
    assert.equal(hit.totalSeconds, 400);
    assert.equal(formatHitSummary(hit), "10 × 20s · 6:40");
  });

  it("stores equal intervals as 20s and splits as 20/15", () => {
    assert.equal(formatHitReps(20, 20), "20s");
    assert.equal(formatHitReps(20, 15), "20/15");
  });
});
