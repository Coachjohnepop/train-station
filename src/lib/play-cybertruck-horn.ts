"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";

const HORN_SRC = "/audio/rest-cybertruck-horn-v2.mp3";

let hornAudio: HTMLAudioElement | null = null;

/** Real Cybertruck horn sample — rest timer / legacy callers. */
export function playCybertruckHorn(): void {
  if (typeof window === "undefined") return;
  try {
    if (!hornAudio) {
      hornAudio = new Audio(HORN_SRC);
      hornAudio.preload = "auto";
      hornAudio.addEventListener("ended", () => {
        hornRelease?.();
        hornRelease = null;
      });
    }
    // Match rest-complete Cybertruck level (hotter than whistle/bell/buzzer).
    hornAudio.volume = 0.85;
    hornRelease?.();
    hornRelease = holdBackgroundMusicForMedia();
    hornAudio.currentTime = 0;
    void hornAudio.play().catch(() => {
      hornRelease?.();
      hornRelease = null;
    });
  } catch {
    /* Audio blocked or unavailable */
  }
}

let hornRelease: (() => void) | null = null;