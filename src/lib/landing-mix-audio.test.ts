import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canStartThemeSongFromSilence,
  clampMixVolume,
  clampThemeSongClickStarts,
  isAllowedHeroAudioUrl,
  isHeroAudioSrc,
  mixVolumePercent,
  THEME_SONG_CLICK_STARTS_DEFAULT,
  THEME_SONG_DEFAULT_VOLUME,
} from "./landing-mix-audio";

describe("landing mix volume", () => {
  it("keeps 0–1 linear values", () => {
    assert.equal(clampMixVolume(0.55), 0.55);
    assert.equal(clampMixVolume(0), 0);
    assert.equal(clampMixVolume(1), 1);
  });

  it("accepts 0–100 percent", () => {
    assert.equal(clampMixVolume(55), 0.55);
    assert.equal(clampMixVolume(100), 1);
    assert.equal(clampMixVolume(0), 0);
  });

  it("falls back and clamps", () => {
    assert.equal(clampMixVolume("nope", THEME_SONG_DEFAULT_VOLUME), THEME_SONG_DEFAULT_VOLUME);
    assert.equal(clampMixVolume(-4), 0);
    assert.equal(clampMixVolume(400), 1);
  });

  it("rounds percent labels", () => {
    assert.equal(mixVolumePercent(0.55), 55);
    assert.equal(mixVolumePercent(1), 100);
  });
});

describe("theme song click starts", () => {
  it("defaults to one", () => {
    assert.equal(clampThemeSongClickStarts(undefined), THEME_SONG_CLICK_STARTS_DEFAULT);
    assert.equal(THEME_SONG_CLICK_STARTS_DEFAULT, 1);
  });

  it("clamps 1–9", () => {
    assert.equal(clampThemeSongClickStarts(0), 1);
    assert.equal(clampThemeSongClickStarts(3), 3);
    assert.equal(clampThemeSongClickStarts(99), 9);
  });

  it("allows N starts from silence", () => {
    assert.equal(canStartThemeSongFromSilence(0, 1), true);
    assert.equal(canStartThemeSongFromSilence(1, 1), false);
    assert.equal(canStartThemeSongFromSilence(2, 3), true);
    assert.equal(canStartThemeSongFromSilence(3, 3), false);
  });
});

describe("hero audio urls", () => {
  it("accepts audio extensions and blob paths", () => {
    assert.equal(isHeroAudioSrc("/uploads/hero/a.mp3"), true);
    assert.equal(isHeroAudioSrc("clip.m4a"), true);
    assert.equal(isHeroAudioSrc("clip.mp4"), false);
    assert.equal(isAllowedHeroAudioUrl("/uploads/hero/bed.mp3"), true);
    assert.equal(
      isAllowedHeroAudioUrl("https://abc.public.blob.vercel-storage.com/hero/x.m4a"),
      true,
    );
  });
});
