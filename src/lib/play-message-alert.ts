/**
 * Short alert when unread messages increase while the app is open.
 * Pure dual-tone train-whistle SFX (no speech / no vocal sample).
 */

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";

const ALERT_SRC = "/audio/rest-train-whistle.mp3";
const SOUND_OFF_KEY = "ts-message-alert-muted";

let alertAudio: HTMLAudioElement | null = null;

export function isMessageAlertMuted(): boolean {
  try {
    return window.localStorage.getItem(SOUND_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMessageAlertMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(SOUND_OFF_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function playMessageAlert(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isMessageAlertMuted()) return;

  let release: (() => void) | null = null;
  try {
    release = holdBackgroundMusicForMedia();
    if (!alertAudio) {
      alertAudio = new Audio(ALERT_SRC);
      alertAudio.preload = "auto";
      alertAudio.volume = 0.9;
    }
    alertAudio.currentTime = 0;
    await alertAudio.play();
  } catch {
    /* autoplay blocked until user gesture — silent fail */
  } finally {
    // Release duck after whistle finishes (~1.5s)
    window.setTimeout(() => release?.(), 1600);
  }
}
