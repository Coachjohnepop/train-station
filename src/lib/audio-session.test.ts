import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  currentAudioSessionType,
  preferAmbientAudioSession,
  preferPlaybackAudioSession,
  preferTransientAudioSession,
  setAudioSession,
} from "./audio-session";

const originalNavigator = globalThis.navigator;

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
});

describe("audio session", () => {
  it("is a no-op when navigator has no audioSession", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
    assert.equal(currentAudioSessionType(), null);
    assert.equal(preferAmbientAudioSession(), false);
    assert.equal(preferPlaybackAudioSession(), false);
  });

  it("writes ambient / transient / playback on Safari audioSession", () => {
    const session = { type: "auto" };
    Object.defineProperty(globalThis, "navigator", {
      value: { audioSession: session },
      configurable: true,
      writable: true,
    });
    assert.equal(preferAmbientAudioSession(), true);
    assert.equal(session.type, "ambient");
    assert.equal(preferTransientAudioSession(), true);
    assert.equal(session.type, "transient");
    assert.equal(preferPlaybackAudioSession(), true);
    assert.equal(session.type, "playback");
    assert.equal(currentAudioSessionType(), "playback");
    assert.equal(setAudioSession("ambient"), true);
    assert.equal(session.type, "ambient");
  });
});
