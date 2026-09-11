"use client";

/**
 * How it Works narration — same rules as the Free ticket gag / rest horn:
 * one element, one play(), never pause-and-restart the same clip.
 */

import {
  preferAmbientAudioSession,
  preferPlaybackAudioSession,
} from "@/lib/audio-session";
import { setBackgroundMusicDuck } from "@/lib/background-music-control";
import { MIX_AUDIO_ATTR } from "@/lib/landing-mix-audio";
import {
  howItWorksHasVoice,
  howItWorksVoiceWindow,
  type HowItWorksStep,
} from "@/lib/how-it-works";

let voice: HTMLAudioElement | null = null;
let playingKey = "";
let endWatch: (() => void) | null = null;

function voiceKey(step: HowItWorksStep): string {
  return `${step.id}:${step.voice.audioUrl}:${step.voice.startSec}:${step.voice.endSec ?? ""}`;
}

function getVoice(): HTMLAudioElement {
  if (!voice) {
    voice = new Audio();
    voice.preload = "auto";
    voice.setAttribute(MIX_AUDIO_ATTR, "true");
    voice.setAttribute("playsinline", "true");
    voice.addEventListener("ended", () => {
      playingKey = "";
      setBackgroundMusicDuck(false);
    });
    voice.addEventListener("error", () => {
      playingKey = "";
      setBackgroundMusicDuck(false);
    });
  }
  return voice;
}

function clearEndWatch(): void {
  if (!endWatch) return;
  const audio = voice;
  if (audio) audio.removeEventListener("timeupdate", endWatch);
  endWatch = null;
}

export function startHowItWorksVoice(step: HowItWorksStep | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!step || !howItWorksHasVoice(step) || !step.voice.audioUrl) {
    stopHowItWorksVoice();
    return;
  }

  const audio = getVoice();
  const key = voiceKey(step);
  if (playingKey === key && !audio.paused) return;

  playingKey = key;
  clearEndWatch();

  const url = step.voice.audioUrl;
  const alreadyThisSrc =
    audio.getAttribute("src") === url || (audio.src && audio.src.endsWith(url));
  if (!alreadyThisSrc) {
    audio.src = url;
  }

  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const { start, end } = howItWorksVoiceWindow(step.voice, duration || null);
  if (start > 0.05) {
    try {
      audio.currentTime = start;
    } catch {
      /* iOS may ignore until play */
    }
  }

  if (end != null) {
    const guard = () => {
      if (playingKey !== key) return;
      if (audio.currentTime >= end - 0.05) stopHowItWorksVoice();
    };
    endWatch = guard;
    audio.addEventListener("timeupdate", guard);
  }

  preferPlaybackAudioSession();
  void audio
    .play()
    .then(() => {
      if (playingKey !== key) return;
      setBackgroundMusicDuck(true);
    })
    .catch(() => {
      if (playingKey !== key) return;
      playingKey = "";
      setBackgroundMusicDuck(false);
      preferAmbientAudioSession();
    });
}

/** Hard stop — tour closed or moved to a screen with no clip. Never call from effect cleanup. */
export function stopHowItWorksVoice(): void {
  playingKey = "";
  clearEndWatch();
  setBackgroundMusicDuck(false);
  preferAmbientAudioSession();
  if (!voice) return;
  voice.pause();
}
