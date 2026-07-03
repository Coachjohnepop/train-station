"use client";

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
    }
    hornAudio.currentTime = 0;
    void hornAudio.play().catch(() => {});
  } catch {
    /* Audio blocked or unavailable */
  }
}