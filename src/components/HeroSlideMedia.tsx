"use client";

import { useEffect, useRef } from "react";
import {
  heroPlaybackRate,
  heroSlideCropStyle,
  isHeroVideoSrc,
  type HeroSlide,
} from "@/lib/hero-slides";

/**
 * One landing-hero / splash frame: photo or muted looping video, with crop + slow-mo.
 */
export default function HeroSlideMedia({
  slide,
  active,
  className = "",
  alt,
  fetchPriority,
}: {
  slide: HeroSlide;
  active: boolean;
  className?: string;
  alt?: string;
  fetchPriority?: "high" | "low" | "auto";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = slide.kind === "video" || isHeroVideoSrc(slide.src);
  const crop = heroSlideCropStyle(slide);
  const label = alt || slide.alt || "Hero";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.playbackRate = reduce ? 1 : heroPlaybackRate(slide);
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    if (active) {
      const play = el.play();
      if (play && typeof play.catch === "function") play.catch(() => null);
    } else {
      el.pause();
    }
  }, [active, slide, slide.playbackRate, slide.src]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        className={`ts-inapp-video ${className}`}
        src={slide.src}
        poster={undefined}
        muted
        loop
        playsInline
        autoPlay={active}
        preload={active ? "auto" : "metadata"}
        aria-label={label}
        style={crop}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.src}
      alt={label}
      fetchPriority={fetchPriority}
      className={className}
      style={crop}
    />
  );
}
