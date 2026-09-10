"use client";

import { useEffect, useRef } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import { howItWorksHasVoice, howItWorksVoiceWindow, type HowItWorksStep } from "@/lib/how-it-works";

/**
 * Plays the trimmed voice-over for one How it Works screen.
 * Calls onReady(true) when the clip ends, fails, or there is no audio —
 * that is when the big Next button may appear.
 */
export default function HowItWorksVoice({
  step,
  active,
  onReady,
}: {
  step: HowItWorksStep | null;
  active: boolean;
  onReady: (ready: boolean) => void;
}) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!active || !step) {
      onReadyRef.current(true);
      return;
    }
    if (!howItWorksHasVoice(step) || !step.voice.audioUrl) {
      onReadyRef.current(true);
      return;
    }

    onReadyRef.current(false);
    const audio = new Audio(step.voice.audioUrl);
    audio.preload = "auto";
    let stopped = false;
    let duration = 0;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      audio.pause();
      setBackgroundMusicOverlay(false);
      onReadyRef.current(true);
    };

    const applyTrimAndPlay = () => {
      duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const { start, end } = howItWorksVoiceWindow(step.voice, duration || null);
      try {
        audio.currentTime = start;
      } catch {
        /* iOS may need a play() first */
      }
      const guard = () => {
        if (end != null && audio.currentTime >= end - 0.05) finish();
      };
      audio.addEventListener("timeupdate", guard);
      setBackgroundMusicOverlay(true);
      void audio.play().then(guard).catch(() => finish());
    };

    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    if (audio.readyState >= 1) applyTrimAndPlay();
    else audio.addEventListener("loadedmetadata", applyTrimAndPlay, { once: true });

    return () => {
      stopped = true;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setBackgroundMusicOverlay(false);
    };
  }, [active, step]);

  if (!active || !howItWorksHasVoice(step)) return null;

  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#e9d5ff]">
      Jeremy is talking…
    </p>
  );
}
