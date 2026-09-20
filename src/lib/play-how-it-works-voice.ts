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
let dualMonoCtx: AudioContext | null = null;
let dualMonoHooked = false;

function hookDualMono(audio: HTMLAudioElement): void {
  if (dualMonoHooked || typeof window === "undefined") return;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    audio.crossOrigin = "anonymous";
    dualMonoCtx = dualMonoCtx ?? new AC();
    const source = dualMonoCtx.createMediaElementSource(audio);
    const split = dualMonoCtx.createChannelSplitter(2);
    const merge = dualMonoCtx.createChannelMerger(2);
    source.connect(split);
    // Copy L and R into both speakers so a left-only phone recording is dual-mono.
    split.connect(merge, 0, 0);
    split.connect(merge, 0, 1);
    split.connect(merge, 1, 0);
    split.connect(merge, 1, 1);
    merge.connect(dualMonoCtx.destination);
    dualMonoHooked = true;
  } catch {
    dualMonoHooked = false;
  }
}

function voiceKey(step: HowItWorksStep): string {
  return `${step.id}:${step.voice.audioUrl}:${step.voice.startSec}:${step.voice.endSec ?? ""}`;
}

function getVoice(): HTMLAudioElement {
  if (!voice) {
    voice = new Audio();
    voice.preload = "auto";
    voice.crossOrigin = "anonymous";
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

/** Set src and buffer without playing — call as soon as the tour can open. */
export function primeHowItWorksVoice(step: HowItWorksStep | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!step || !howItWorksHasVoice(step) || !step.voice.audioUrl) return;
  const audio = getVoice();
  const url = step.voice.audioUrl;
  const already =
    audio.getAttribute("src") === url || (audio.src && audio.src.endsWith(url.split("?")[0] || url));
  if (!already) {
    audio.src = url;
  }
  audio.preload = "auto";
  try {
    audio.load();
  } catch {
    /* ignore */
  }
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
  const seekStart = () => {
    if (start <= 0.05) return;
    try {
      audio.currentTime = start;
    } catch {
      /* iOS may ignore until play */
    }
  };
  seekStart();
  audio.addEventListener("playing", seekStart, { once: true });
  hookDualMono(audio);

  if (end != null) {
    const guard = () => {
      if (playingKey !== key) return;
      if (audio.currentTime >= end - 0.05) stopHowItWorksVoice();
    };
    endWatch = guard;
    audio.addEventListener("timeupdate", guard);
  }

  preferPlaybackAudioSession();
  void (async () => {
    try {
      if (dualMonoCtx && dualMonoCtx.state === "suspended") await dualMonoCtx.resume();
    } catch {
      /* ignore */
    }
    return audio.play();
  })()
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
