import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countLeadsByFilter,
  leadMatchesFilter,
  normalizeLeadLane,
} from "./waitlist-lane";

describe("lead lanes", () => {
  it("treats missing and unknown lanes as inbox", () => {
    assert.equal(normalizeLeadLane(undefined), "inbox");
    assert.equal(normalizeLeadLane(null), "inbox");
    assert.equal(normalizeLeadLane("pending"), "inbox");
    assert.equal(normalizeLeadLane("drip"), "drip");
    assert.equal(normalizeLeadLane("convert"), "convert");
    assert.equal(normalizeLeadLane("archive"), "archive");
  });

  it("hides archived leads from All and keeps drip/convert in All", () => {
    const inbox = { lane: "inbox" };
    const drip = { lane: "drip" };
    const convert = { lane: "convert" };
    const archive = { lane: "archive" };

    assert.equal(leadMatchesFilter(inbox, "all"), true);
    assert.equal(leadMatchesFilter(drip, "all"), true);
    assert.equal(leadMatchesFilter(convert, "all"), true);
    assert.equal(leadMatchesFilter(archive, "all"), false);
    assert.equal(leadMatchesFilter(drip, "drip"), true);
    assert.equal(leadMatchesFilter(convert, "convert"), true);
    assert.equal(leadMatchesFilter(archive, "archive"), true);
    assert.equal(leadMatchesFilter(inbox, "drip"), false);
  });

  it("counts extra tabs from exclusive lanes", () => {
    const counts = countLeadsByFilter([
      { lane: null },
      { lane: "drip" },
      { lane: "drip" },
      { lane: "convert" },
      { lane: "archive" },
    ]);
    assert.deepEqual(counts, { all: 4, drip: 2, convert: 1, archive: 1 });
  });
});
