"use client";

import { useEffect, useRef } from "react";
import { howItWorksHasVoice, type HowItWorksStep } from "@/lib/how-it-works";
import { startHowItWorksVoice, stopHowItWorksVoice } from "@/lib/play-how-it-works-voice";

/**
 * How it Works narration. Same contract as the Free ticket gag:
 * one shared Audio element, one play(), no pause in effect cleanup
 * (that restart was the lisp-adjacent “starts, stops, starts again”).
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
  const url = step?.voice.audioUrl ?? "";
  const voiceKey = `${step?.id ?? ""}:${url}:${step?.voice.startSec ?? 0}:${step?.voice.endSec ?? ""}`;

  useEffect(() => {
    const current = stepRef.current;
    if (!active || !howItWorksHasVoice(current)) {
      stopHowItWorksVoice();
      return;
    }
    startHowItWorksVoice(current);
    // Do not pause on cleanup — React remount would rewind the clip.
  }, [active, voiceKey]);

  if (!active || !howItWorksHasVoice(step)) return null;

  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#e9d5ff]">
      Jeremy is talking…
    </p>
  );
}
