import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLiveZoomJoinable,
  nextHeldLiveZoomStatus,
  sameLiveZoomStatus,
  type LiveZoomJoinBits,
} from "./live-zoom-status-hold";

const live: LiveZoomJoinBits = {
  sessionDate: "2026-08-18",
  roomReady: true,
  hostStarted: true,
  canJoin: true,
  joinUrl: "https://zoom.us/j/1",
};

const waiting: LiveZoomJoinBits = {
  sessionDate: "2026-08-18",
  roomReady: true,
  hostStarted: false,
  canJoin: false,
  joinUrl: null,
};

describe("live-zoom-status-hold", () => {
  it("treats joinable as host + url + canJoin", () => {
    assert.equal(isLiveZoomJoinable(live), true);
    assert.equal(isLiveZoomJoinable(waiting), false);
    assert.equal(isLiveZoomJoinable({ ...live, joinUrl: null }), false);
  });

  it("compares status by bits, not object identity", () => {
    assert.equal(sameLiveZoomStatus(live, { ...live }), true);
    assert.equal(sameLiveZoomStatus(live, waiting), false);
  });

  it("accepts live immediately and holds Join across a stale not-live poll", () => {
    const up = nextHeldLiveZoomStatus(null, live, { notLiveSince: null }, 1_000);
    assert.equal(isLiveZoomJoinable(up.status), true);
    assert.equal(up.notLiveSince, null);

    const flap = nextHeldLiveZoomStatus(up.status, waiting, { notLiveSince: null }, 1_100);
    assert.deepEqual(flap.status, live);
    assert.equal(flap.notLiveSince, 1_100);

    const stillHeld = nextHeldLiveZoomStatus(
      flap.status,
      waiting,
      { notLiveSince: flap.notLiveSince },
      1_100 + 7_000,
    );
    assert.deepEqual(stillHeld.status, live);

    const released = nextHeldLiveZoomStatus(
      stillHeld.status,
      waiting,
      { notLiveSince: stillHeld.notLiveSince },
      1_100 + 8_000,
    );
    assert.deepEqual(released.status, waiting);
    assert.equal(released.notLiveSince, null);
  });

  it("ignores a null incoming tick so a failed poll cannot blank Join", () => {
    const held = nextHeldLiveZoomStatus(live, null, { notLiveSince: null }, 50);
    assert.deepEqual(held.status, live);
  });
});
