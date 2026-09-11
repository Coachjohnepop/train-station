import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REST_MUTE_KEY,
  readRestTimerMuted,
  restSoundAllowed,
  writeRestTimerMuted,
} from "./rest-timer-mute";

function memoryStore(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    data,
  };
}

describe("rest timer mute", () => {
  it("does not play horn or ticks while muted", () => {
    assert.equal(restSoundAllowed(true), false);
    assert.equal(restSoundAllowed(false), true);
  });

  it("persists mute so a remount does not honk again", () => {
    const store = memoryStore();
    writeRestTimerMuted(true, store);
    assert.equal(store.data[REST_MUTE_KEY], "1");
    assert.equal(readRestTimerMuted(store), true);
    writeRestTimerMuted(false, store);
    assert.equal(readRestTimerMuted(store), false);
  });

  it("stays muted across a simulated Today refresh", () => {
    const store = memoryStore();
    writeRestTimerMuted(true, store);
    // New console mount reads storage instead of forcing unmute.
    const restored = readRestTimerMuted(store);
    assert.equal(restSoundAllowed(restored), false);
  });
});
