"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";

const HORN_SRC = "/audio/rest-cybertruck-horn.mp3";

let hornAudio: HTMLAudioElement | null = null;

/** Pure dual-tone horn SFX (no speech) — rest timer / legacy callers. */
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