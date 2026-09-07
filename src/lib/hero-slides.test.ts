import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HERO_AUDIO_DEFAULT_VOLUME } from "./landing-mix-audio";
import {
  createEmptyHeroSlide,
  heroSlideShouldLoadMedia,
  normalizeHeroSlide,
} from "./hero-slides";

describe("heroSlideShouldLoadMedia", () => {
  const video = { kind: "video" as const, src: "/videos/a.mp4" };
  const photo = { kind: "image" as const, src: "/images/a.jpg" };

  it("always loads photos", () => {
    assert.equal(heroSlideShouldLoadMedia(2, 0, 3, photo), true);
  });

  it("loads the active video and the next one for crossfade", () => {
    assert.equal(heroSlideShouldLoadMedia(0, 0, 3, video), true);
    assert.equal(heroSlideShouldLoadMedia(1, 0, 3, video), true);
    assert.equal(heroSlideShouldLoadMedia(2, 0, 3, video), false);
  });

  it("keeps a fading-out clip mounted", () => {
    assert.equal(heroSlideShouldLoadMedia(2, 0, 3, video, [2]), true);
  });
});

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
