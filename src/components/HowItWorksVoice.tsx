"use client";

import { useEffect, useRef } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import { MIX_AUDIO_ATTR } from "@/lib/landing-mix-audio";
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
  const stepRef = useRef(step);
  stepRef.current = step;
  const voiceKey = `${step?.id ?? ""}:${step?.voice.audioUrl ?? ""}:${step?.voice.startSec ?? 0}:${step?.voice.endSec ?? ""}`;

  useEffect(() => {
    const current = stepRef.current;
    if (!active || !current) {
      onReadyRef.current(true);
      return;
    }
    if (!howItWorksHasVoice(current) || !current.voice.audioUrl) {
      onReadyRef.current(true);
      return;
    }

    onReadyRef.current(false);
    const audio = new Audio(current.voice.audioUrl);
    audio.preload = "auto";
    audio.setAttribute(MIX_AUDIO_ATTR, "true");
    let stopped = false;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      audio.pause();
      setBackgroundMusicOverlay(false);
      onReadyRef.current(true);
    };

    const applyTrimAndPlay = () => {
      if (stopped) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const { start, end } = howItWorksVoiceWindow(current.voice, duration || null);
      try {
        audio.currentTime = start;
      } catch {
        /* iOS may need a play() first */
      }
      const guard = () => {
        if (end != null && audio.currentTime >= end - 0.05) finish();
      };
      audio.addEventListener("timeupdate", guard);
      void audio
        .play()
        .then(() => {
          if (stopped) return;
          setBackgroundMusicOverlay(true);
          guard();
        })
        .catch(() => finish());
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
  }, [active, voiceKey]);

  if (!active || !howItWorksHasVoice(step)) return null;

  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#e9d5ff]">
      Jeremy is talking…
    </p>
  );
}
