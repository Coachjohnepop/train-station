"use client";

import { useEffect, useRef, useState } from "react";
import {
  heroPlaybackRate,
  heroSlideCropStyle,
  heroTrimWindow,
  isHeroVideoSrc,
  type HeroSlide,
} from "@/lib/hero-slides";
import {
  applyMixVolume,
  isLandingMixUnlocked,
  onLandingMixUnlock,
} from "@/lib/landing-mix-audio";

/**
 * One landing-hero / splash frame: photo or muted looping video, with crop, trim, and slow-mo.
 * Optional separate audio bed (video picture stays muted). Mixes with Theme Song.
 */
export default function HeroSlideMedia({
  slide,
  active,
  className = "",
  alt,
  fetchPriority,
  onDuration,
  playAudio,
}: {
  slide: HeroSlide;
  active: boolean;
  className?: string;
  alt?: string;
  fetchPriority?: "high" | "low" | "auto";
  onDuration?: (seconds: number) => void;
  /** Play this slide's audioSrc. Default = active (public carousel). */
  playAudio?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  const [videoReady, setVideoReady] = useState(false);
  const isVideo = slide.kind === "video" || isHeroVideoSrc(slide.src);
  const crop = heroSlideCropStyle(slide);
  const label = alt || slide.alt || "Hero";
  const audioOn = (playAudio ?? active) && Boolean(slide.audioSrc);

  useEffect(() => {
    setVideoReady(false);
  }, [slide.src]);

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

    const applyWindow = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
      if (duration) onDurationRef.current?.(duration);
      const { start, end } = heroTrimWindow(slide, duration);
      if (el.currentTime < start - 0.05 || (end != null && el.currentTime >= end - 0.05)) {
        el.currentTime = start;
      }
    };

    const onMeta = () => {
      applyWindow();
      if (active) {
        const play = el.play();
        if (play && typeof play.catch === "function") play.catch(() => null);
      }
    };
    const onTime = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
      const { start, end } = heroTrimWindow(slide, duration);
      const limit = end ?? duration;
      if (limit != null && el.currentTime >= limit - 0.04) {
        el.currentTime = start;
        if (active) {
          const play = el.play();
          if (play && typeof play.catch === "function") play.catch(() => null);
        }
      }
    };

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    applyWindow();

    if (active) {
      const play = el.play();
      if (play && typeof play.catch === "function") play.catch(() => null);
    } else {
      el.pause();
    }

    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
    };
  }, [active, slide, slide.playbackRate, slide.src, slide.trimStartSec, slide.trimEndSec]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    applyMixVolume(el, slide.audioVolume);
    const sync = () => {
      if (!audioOn) {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        return;
      }
      if (!isLandingMixUnlocked()) return;
      el.loop = true;
      el.muted = false;
      applyMixVolume(el, slide.audioVolume);
      const play = el.play();
      if (play && typeof play.catch === "function") play.catch(() => null);
    };
    const unsub = onLandingMixUnlock(sync);
    sync();
    return () => {
      unsub();
      el.pause();
    };
  }, [audioOn, slide.audioSrc, slide.audioVolume]);

  const bed =
    slide.audioSrc ? (
      <audio
        ref={audioRef}
        src={slide.audioSrc}
        loop
        preload={audioOn ? "auto" : "none"}
        playsInline
        data-ts-hero-audio="true"
      />
    ) : null;

  if (isVideo) {
    const trimmed = slide.trimStartSec > 0 || slide.trimEndSec != null;
    return (
      <>
        <video
          ref={videoRef}
          className={`ts-inapp-video bg-black transition-opacity duration-500 ${
            videoReady ? "opacity-100" : "opacity-0"
          } ${className}`}
          src={slide.src}
          muted
          loop={!trimmed}
          playsInline
          autoPlay={active}
          preload={active ? "auto" : "metadata"}
          aria-label={label}
          style={{ ...crop, backgroundColor: "#000" }}
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
        />
        {bed}
      </>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.src}
        alt={label}
        fetchPriority={fetchPriority}
        className={className}
        style={crop}
      />
      {bed}
    </>
  );
}
