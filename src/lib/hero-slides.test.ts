import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HERO_AUDIO_DEFAULT_VOLUME } from "./landing-mix-audio";
import { createEmptyHeroSlide, normalizeHeroSlide } from "./hero-slides";

describe("hero slide audio", () => {
  it("defaults to no audio bed", () => {
    const slide = createEmptyHeroSlide("/images/splash/black-guy.jpg");
    assert.equal(slide.audioSrc, null);
    assert.equal(slide.audioVolume, HERO_AUDIO_DEFAULT_VOLUME);
  });

  it("keeps a valid audio url and volume", () => {
    const slide = normalizeHeroSlide({
      src: "/images/splash/black-guy.jpg",
      audioSrc: "/uploads/hero/bed.mp3",
      audioVolume: 0.4,
    });
    assert.ok(slide);
    assert.equal(slide.audioSrc, "/uploads/hero/bed.mp3");
    assert.equal(slide.audioVolume, 0.4);
  });

  it("drops invalid audio urls", () => {
    const slide = normalizeHeroSlide({
      src: "/images/splash/black-guy.jpg",
      audioSrc: "javascript:alert(1)",
    });
    assert.ok(slide);
    assert.equal(slide.audioSrc, null);
  });
});
