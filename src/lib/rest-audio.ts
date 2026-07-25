"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  DEFAULT_REST_TIMER_SOUND,
  normalizeRestTimerSound,
  restTimerSoundSrc,
  restTimerSoundVolume,
  type RestTimerSoundId,
} from "@/lib/rest-timer-sound";

let audioCtx: AudioContext | null = null;
/** One reusable element per src — recreated if a load/play errors. */
const sampleCache = new Map<string, HTMLAudioElement>();
let sampleRelease: (() => void) | null = null;
let sampleReleaseToken = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Quiet rest click — soft short pulse so it can play every second without being harsh.
 * `urgent` = last 5 seconds: pitch up + 1.5× volume so the floor notices.
 */
export function playRestTick(urgent = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 760 : 520;
    // Base click; last 5 ticks 1.5× prior urgent level so the floor notices.
    const peak = urgent ? 0.055 * 1.5 : 0.028;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    /* ignore */
  }
}

/** Soft start chirp when rest begins (after a set is checked). */
export function playRestStart(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* ignore */
  }
}

/** Fallback buzz if the chosen sample fails — 50% quieter than prior gym level. */
function playRestCompleteFallback(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const peak = 0.11; // was 0.22
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peak, now + 0.05);
    master.gain.setValueAtTime(peak, now + 0.4);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    master.connect(ctx.destination);

    for (const t of [
      { freq: 440, type: "square" as OscillatorType, gain: 0.55 },
      { freq: 554, type: "sawtooth" as OscillatorType, gain: 0.35 },
    ]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type;
      osc.frequency.value = t.freq;
      g.gain.value = t.gain;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.9);
    }
  } catch {
    /* ignore */
  }
}

function releaseSampleHold(token: number): void {
  if (token !== sampleReleaseToken) return;
  sampleRelease?.();
  sampleRelease = null;
}

function getOrCreateSample(src: string): HTMLAudioElement {
  let audio = sampleCache.get(src);
  if (audio) return audio;
  audio = new Audio(src);
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    // Drop broken cache entry so the next try fetches a fresh element.
    if (sampleCache.get(src) === audio) sampleCache.delete(src);
  });
  sampleCache.set(src, audio);
  return audio;
}

/**
 * End-of-rest alert — coach-selected sample (default Cybertruck honk).
 * Volumes are scaled via restTimerSoundVolume (~50% of prior levels).
 */
export function playRestComplete(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  const id = normalizeRestTimerSound(sound);
  const src = restTimerSoundSrc(id);
  const volume = restTimerSoundVolume(id);

  try {
    // Resume audio context early (iOS) — helps after mute/unlock.
    getCtx();

    const audio = getOrCreateSample(src);
    audio.volume = volume;

    sampleRelease?.();
    const token = ++sampleReleaseToken;
    sampleRelease = holdBackgroundMusicForMedia();

    const fail = () => {
      releaseSampleHold(token);
      sampleCache.delete(src);
      playRestCompleteFallback();
    };

    audio.onended = () => releaseSampleHold(token);
    audio.onpause = () => {
      // Only release if fully finished (not a seek pause).
      if (audio.ended) releaseSampleHold(token);
    };

    const start = () => {
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore seek-before-load */
      }
      void audio.play().then(() => {
        // Some browsers report play success with 0 duration if decode failed.
        if (!Number.isFinite(audio.duration) || audio.duration === 0) {
          // Give metadata a beat; if still dead, fall back.
          window.setTimeout(() => {
            if (!Number.isFinite(audio.duration) || audio.duration === 0) fail();
          }, 120);
        }
      }).catch(fail);
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start();
    } else {
      const onReady = () => {
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("loadeddata", onReady);
        start();
      };
      audio.addEventListener("canplay", onReady);
      audio.addEventListener("loadeddata", onReady);
      audio.load();
      // Safety: if events never fire, try play anyway then fallback.
      window.setTimeout(() => {
        if (audio.paused && !audio.ended) start();
      }, 500);
    }
  } catch {
    playRestCompleteFallback();
  }
}

/** Preload chosen sample so the first rest-end isn't delayed. */
export function preloadRestCompleteSound(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  try {
    const src = restTimerSoundSrc(sound);
    const audio = getOrCreateSample(src);
    audio.load();
  } catch {
    /* ignore */
  }
}
