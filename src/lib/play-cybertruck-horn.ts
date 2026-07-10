"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";

const HORN_SRC = "/audio/cybertruck-horn.mp3";

let hornAudio: HTMLAudioElement | null = null;

/** Tesla Cybertruck-style horn — plays when the rest timer hits zero. */
export function playCybertruckHorn(): void {
  if (typeof window === "undefined") return;
  try {
    if (!hornAudio) {
      hornAudio = new Audio(HORN_SRC);
      hornAudio.preload = "auto";
      hornAudio.volume = 0.9;
      hornAudio.addEventListener("ended", () => {
        hornRelease?.();
        hornRelease = null;
      });
    }
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