"use client";

import { useEffect, useRef } from "react";
import {
  heroSlideCropStyle,
  heroTrimWindow,
  type HeroSlide,
} from "@/lib/hero-slides";

/**
 * Still frame of a hero clip (trim start). Does not play — used as a thumbnail
 * so the editor and carousel are not a black box while the file is paused.
 */
export default function HeroVideoThumb({
  slide,
  className = "",
}: {
  slide: HeroSlide;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const crop = heroSlideCropStyle(slide);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const paint = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
      const { start } = heroTrimWindow(slide, duration);
      const t = start < 0.05 ? 0.05 : start;
      if (Math.abs(el.currentTime - t) > 0.08) {
        try {
          el.currentTime = t;
        } catch {
          /* ignore */
        }
      }
    };

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.addEventListener("loadedmetadata", paint);
    el.addEventListener("loadeddata", paint);
    if (el.readyState >= 1) paint();
    return () => {
      el.removeEventListener("loadedmetadata", paint);
      el.removeEventListener("loadeddata", paint);
    };
  }, [slide.src, slide.trimStartSec, slide.trimEndSec]);

  return (
    <video
      ref={videoRef}
      className={`ts-inapp-video ${className}`}
      src={slide.src}
      muted
      playsInline
      preload="metadata"
      aria-hidden
      style={crop}
    />
  );
}
