import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatIntroTime,
  introTrimDurationSec,
  introTrimForSlot,
  introTrimWindow,
  isDefaultIntroTrim,
  normalizeIntroTrim,
  normalizeIntroTrims,
} from "./intro-trim";

describe("normalizeIntroTrim", () => {
  it("defaults empty input to full clip", () => {
    assert.deepEqual(normalizeIntroTrim(null), { startSec: 0, endSec: null });
  });

  it("clamps end after start", () => {
    const t = normalizeIntroTrim({ startSec: 4, endSec: 4.1 });
    assert.equal(t.startSec, 4);
    assert.ok((t.endSec || 0) >= 4.5);
  });
});

describe("introTrimWindow", () => {
  it("caps to duration", () => {
    const w = introTrimWindow({ startSec: 2, endSec: 40 }, 10);
    assert.equal(w.start, 2);
    assert.equal(w.end, 10);
  });

  it("null end means play through", () => {
    const w = introTrimWindow({ startSec: 1.5, endSec: null }, 20);
    assert.equal(w.start, 1.5);
    assert.equal(w.end, null);
  });
});

describe("introTrimDurationSec", () => {
  it("uses end minus start", () => {
    assert.equal(introTrimDurationSec({ startSec: 2, endSec: 8 }, 30), 6);
  });
});

describe("introTrimForSlot", () => {
  it("aliases free and explorer", () => {
    const trims = normalizeIntroTrims({ free: { startSec: 3, endSec: 20 } });
    assert.equal(introTrimForSlot(trims, "explorer").startSec, 3);
    assert.equal(introTrimForSlot(trims, "free").endSec, 20);
  });

  it("drops default windows from the map", () => {
    const trims = normalizeIntroTrims({
      overall: { startSec: 0, endSec: null },
      member: { startSec: 1, endSec: 12 },
    });
    assert.equal(trims.overall, undefined);
    assert.equal(trims.member?.startSec, 1);
  });
});

describe("formatIntroTime / isDefaultIntroTrim", () => {
  it("formats mm:ss.t", () => {
    assert.equal(formatIntroTime(65.2), "1:05.2");
  });

  it("treats empty as default", () => {
    assert.equal(isDefaultIntroTrim({ startSec: 0, endSec: null }), true);
    assert.equal(isDefaultIntroTrim({ startSec: 1, endSec: null }), false);
  });
});
