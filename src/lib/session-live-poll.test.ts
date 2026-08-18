import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIVE_CLASS_POLL_MS,
  MIN_NETWORK_POLL_MS,
  isLiveClassSessionGoing,
} from "./session-live-poll";

describe("session-live-poll", () => {
  it("never allows a live-class poll under 5 seconds", () => {
    assert.equal(MIN_NETWORK_POLL_MS, 5_000);
    assert.ok(LIVE_CLASS_POLL_MS >= MIN_NETWORK_POLL_MS);
  });

  it("treats hostStarted as session going", () => {
    assert.equal(isLiveClassSessionGoing({ hostStarted: true }), true);
    assert.equal(isLiveClassSessionGoing({ hostStarted: false }), false);
    assert.equal(isLiveClassSessionGoing(null), false);
  });
});
