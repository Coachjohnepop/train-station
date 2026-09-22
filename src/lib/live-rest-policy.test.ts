import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  remoteClearIsStale,
  remoteRestIsClear,
  remoteRestShouldIgnore,
  shouldStartRestFromRemoteSetDiff,
} from "./live-rest-policy";

describe("live rest policy", () => {
  it("treats explicit null as a close", () => {
    assert.equal(remoteRestIsClear(null), true);
    assert.equal(remoteRestIsClear(undefined), false);
    assert.equal(
      remoteRestIsClear({ endsAt: 1, blockId: "a", completedSetNum: 1 }),
      false,
    );
  });

  it("ignores expired restActive so a poll cannot reopen a finished timer", () => {
    const now = 1_000_000;
    assert.equal(
      remoteRestShouldIgnore({
        rest: { endsAt: now - 1 },
        now,
        suppressUntil: 0,
        ignoredEndsAt: 0,
      }),
      true,
    );
    assert.equal(
      remoteRestShouldIgnore({
        rest: { endsAt: now + 30_000 },
        now,
        suppressUntil: 0,
        ignoredEndsAt: 0,
      }),
      false,
    );
  });

  it("ignores the same endsAt after skip so SSE/poll cannot resurrect it", () => {
    const now = 1_000_000;
    const endsAt = now + 20_000;
    assert.equal(
      remoteRestShouldIgnore({
        rest: { endsAt },
        now,
        suppressUntil: 0,
        ignoredEndsAt: endsAt,
      }),
      true,
    );
  });

  it("ignores rest during the skip suppress window", () => {
    const now = 1_000_000;
    assert.equal(
      remoteRestShouldIgnore({
        rest: { endsAt: now + 20_000 },
        now,
        suppressUntil: now + 4000,
        ignoredEndsAt: 0,
      }),
      true,
    );
  });

  it("does not close a fresh local rest on an older snapshot", () => {
    const now = 1_000_000;
    assert.equal(
      remoteClearIsStale({
        localEndsAt: now + 90_000,
        now,
        remoteRevision: 4,
        pushedRevision: 4,
      }),
      true,
    );
    assert.equal(
      remoteClearIsStale({
        localEndsAt: now + 90_000,
        now,
        remoteRevision: 5,
        pushedRevision: 4,
      }),
      false,
    );
  });

  it("never starts rest from a remote completedSets diff", () => {
    assert.equal(shouldStartRestFromRemoteSetDiff({ restActivePresent: false }), false);
    assert.equal(shouldStartRestFromRemoteSetDiff({ restActivePresent: true }), false);
  });
});
