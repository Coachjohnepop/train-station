"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  DEFAULT_REST_TIMER_SOUND,
  normalizeRestTimerSound,
  restTimerSoundSrc,
  type RestTimerSoundId,
} from "@/lib/rest-timer-sound";

let audioCtx: AudioContext | null = null;
const sampleCache = new Map<string, HTMLAudioElement>();
let sampleRelease: (() => void) | null = null;

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
 * `urgent` slightly raises pitch/volume in the last few seconds.
 */
export function playRestTick(urgent = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 720 : 520;
    const peak = urgent ? 0.055 : 0.028;
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

/** Loud fallback buzz if the chosen sample fails to load/play. */
function playRestCompleteFallback(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    master.gain.setValueAtTime(0.22, now + 0.4);
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

/**
 * End-of-rest alert — coach-selected sample at near-max volume.
 * Default is train whistle so the gym floor hears it.
 */
export function playRestComplete(sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND): void {
  if (typeof window === "undefined") return;
  const id = normalizeRestTimerSound(sound);
  const src = restTimerSoundSrc(id);

  try {
    let audio = sampleCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      sampleCache.set(src, audio);
    }
    // Loud on purpose — coach wants the floor to hear rest end.
    audio.volume = 1;
    sampleRelease?.();
    sampleRelease = holdBackgroundMusicForMedia();
    audio.onended = () => {
      sampleRelease?.();
      sampleRelease = null;
    };
    audio.currentTime = 0;
    void audio.play().catch(() => {
      sampleRelease?.();
      sampleRelease = null;
      playRestCompleteFallback();
    });
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
    if (sampleCache.has(src)) return;
    const audio = new Audio(src);
    audio.preload = "auto";
    sampleCache.set(src, audio);
  } catch {
    /* ignore */
  }
}
