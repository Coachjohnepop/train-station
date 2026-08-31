import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  heroPlaybackRate,
  heroSlideHoldMs,
  isHeroVideoSrc,
  normalizeHeroSlide,
  parseObjectPosition,
} from "./hero-slides";

describe("parseObjectPosition", () => {
  it("reads percent pairs", () => {
    assert.deepEqual(parseObjectPosition("58% 20%"), { focusX: 58, focusY: 20 });
  });
  it("maps keywords", () => {
    assert.deepEqual(parseObjectPosition("center top"), { focusX: 50, focusY: 0 });
  });
});

describe("hero video slides", () => {
  it("detects mov/mp4", () => {
    assert.equal(isHeroVideoSrc("/uploads/hero/a.mov"), true);
    assert.equal(isHeroVideoSrc("/images/splash/black-guy.jpg"), false);
  });

  it("normalizes a blob video with slow-mo and crop", () => {
    const slide = normalizeHeroSlide({
      src: "https://example.public.blob.vercel-storage.com/hero/clip.mov",
      focusX: 40,
      focusY: 30,
      zoom: 1.4,
      playbackRate: 0.5,
    });
    assert.ok(slide);
    assert.equal(slide!.kind, "video");
    assert.equal(slide!.playbackRate, 0.5);
    assert.equal(slide!.zoom, 1.4);
    assert.equal(slide!.objectPosition, "40% 30%");
    assert.equal(heroPlaybackRate(slide!), 0.5);
    assert.ok(heroSlideHoldMs(slide!) >= 4800);
  });
});
