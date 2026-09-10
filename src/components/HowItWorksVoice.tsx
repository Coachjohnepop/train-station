"use client";

import { useEffect, useRef } from "react";
import { setBackgroundMusicOverlay } from "@/lib/background-music-control";
import { MIX_AUDIO_ATTR } from "@/lib/landing-mix-audio";
import { howItWorksHasVoice, howItWorksVoiceWindow, type HowItWorksStep } from "@/lib/how-it-works";

/**
 * Plays the trimmed voice-over for one How it Works screen.
 * Next is never held for this clip — tap Next to skip.
 */
export default function HowItWorksVoice({
  step,
  active,
}: {
  step: HowItWorksStep | null;
  active: boolean;
}) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const voiceKey = `${step?.id ?? ""}:${step?.voice.audioUrl ?? ""}:${step?.voice.startSec ?? 0}:${step?.voice.endSec ?? ""}`;

  useEffect(() => {
    const current = stepRef.current;
    if (!active || !current || !howItWorksHasVoice(current) || !current.voice.audioUrl) {
      return;
    }

    const audio = new Audio(current.voice.audioUrl);
    audio.preload = "auto";
    audio.setAttribute(MIX_AUDIO_ATTR, "true");
    let stopped = false;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      audio.pause();
      setBackgroundMusicOverlay(false);
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
    const metadataWait = window.setTimeout(applyTrimAndPlay, 2500);
    if (audio.readyState >= 1) applyTrimAndPlay();
    else audio.addEventListener("loadedmetadata", applyTrimAndPlay, { once: true });

    return () => {
      stopped = true;
      window.clearTimeout(metadataWait);
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
