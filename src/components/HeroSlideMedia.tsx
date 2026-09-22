"use client";

import { useEffect, useRef } from "react";
import {
  heroPlaybackRate,
  heroSlideCropStyle,
  heroTrimWindow,
  isHeroVideoSrc,
  type HeroSlide,
} from "@/lib/hero-slides";
import { preferAmbientAudioSession } from "@/lib/audio-session";
import {
  applyMixVolume,
  isLandingMixUnlocked,
  onLandingMixUnlock,
} from "@/lib/landing-mix-audio";

/**
 * One landing-hero / splash frame: photo or muted looping video, with crop, trim, and slow-mo.
 * Optional separate audio bed (video picture stays muted). Mixes with Theme Song.
 * Playback follows Free gag rules: one element, one play(), no play-then-pause kick.
 */
export default function HeroSlideMedia({
  slide,
  active,
  className = "",
  alt,
  fetchPriority,
  onDuration,
  onEnded,
  playAudio,
}: {
  slide: HeroSlide;
  active: boolean;
  className?: string;
  alt?: string;
  fetchPriority?: "high" | "low" | "auto";
  onDuration?: (seconds: number) => void;
  /** Fired when the clip hits trim end or native ended — do not loop. */
  onEnded?: () => void;
  /** Play this slide's audioSrc. Default = active (public carousel). */
  playAudio?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const isVideo = slide.kind === "video" || isHeroVideoSrc(slide.src);
  const crop = heroSlideCropStyle(slide);
  const label = alt || slide.alt || "Hero";
  const audioOn = (playAudio ?? active) && Boolean(slide.audioSrc);

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
    };
    let handedOff = false;
    const handoff = () => {
      if (!active || handedOff) return;
      handedOff = true;
      // Keep playing through the crossfade. Pausing here freezes the last frame on screen.
      onEndedRef.current?.();
    };

    const onTime = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
      const { start, end } = heroTrimWindow(slide, duration);
      const limit = end ?? duration;
      if (limit == null) return;
      const span = Math.max(0, limit - start);
      const lead = Math.min(1, Math.max(0, span - 0.2));
      if (el.currentTime >= limit - lead) handoff();
    };

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", handoff);
    if (el.readyState >= 1) applyWindow();

    if (active) {
      if (el.paused) {
        preferAmbientAudioSession();
        void el.play().catch(() => null);
      }
    } else if (!el.paused) {
      el.pause();
      applyWindow();
    }

    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", handoff);
    };
  }, [active, slide.playbackRate, slide.src, slide.trimStartSec, slide.trimEndSec]);

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
      el.loop = false;
      el.muted = false;
      applyMixVolume(el, slide.audioVolume);
      const play = el.play();
      if (play && typeof play.catch === "function") play.catch(() => null);
    };
    const unsub = onLandingMixUnlock(sync);
    sync();
    return () => {
      unsub();
    };
  }, [audioOn, slide.audioSrc, slide.audioVolume]);

  const bed =
    slide.audioSrc ? (
      <audio
        ref={audioRef}
        src={slide.audioSrc}
        preload={audioOn ? "auto" : "none"}
        playsInline
        data-ts-hero-audio="true"
      />
    ) : null;

  if (isVideo) {
    return (
      <>
        <video
          ref={videoRef}
          className={`ts-inapp-video bg-black ${className}`}
          src={slide.src}
          muted
          loop={false}
          playsInline
          autoPlay={false}
          preload="auto"
          aria-label={label}
          style={{ ...crop, backgroundColor: "#000" }}
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
