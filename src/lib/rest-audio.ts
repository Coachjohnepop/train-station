"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  DEFAULT_REST_TIMER_SOUND,
  normalizeRestTimerSound,
  restTimerSoundFallbackSrc,
  restTimerSoundSrc,
  restTimerSoundVolume,
  type RestTimerSoundId,
} from "@/lib/rest-timer-sound";

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const decodeInFlight = new Map<string, Promise<AudioBuffer | null>>();
let sampleRelease: (() => void) | null = null;
let sampleReleaseToken = 0;
/** True after a user-gesture unlock succeeded (iOS / Safari autoplay). */
let audioUnlocked = false;

/** Global de-dupe so live coach+member retargets don't stack chirps/horns. */
let lastStartAt = 0;
let lastTickAt = 0;
let lastTickSec = -1;
let lastPopAt = 0;
let lastCompleteAt = 0;
let completeInFlight = false;

const START_GAP_MS = 900;
const TICK_GAP_MS = 180;
const POP_GAP_MS = 70;
const COMPLETE_GAP_MS = 1800;

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

async function ensureRunningCtx(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  return ctx;
}

/**
 * Soft set-check "pop" when a set is marked done (member or coach).
 * Distinct from rest ticks / end horn — short and quiet.
 */
export function playSetCheckPop(): void {
  const nowMs = Date.now();
  if (nowMs - lastPopAt < POP_GAP_MS) return;
  lastPopAt = nowMs;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    /* ignore */
  }
}

/**
 * Quiet rest click — soft short pulse so it can play every second without being harsh.
 * `urgent` = last 5 seconds: pitch up + 1.5× volume so the floor notices.
 */
export function playRestTick(urgent = false, secondLeft?: number): void {
  const nowMs = Date.now();
  // One tick per countdown second (and never stack within TICK_GAP_MS).
  if (typeof secondLeft === "number" && secondLeft === lastTickSec && nowMs - lastTickAt < 1200) {
    return;
  }
  if (nowMs - lastTickAt < TICK_GAP_MS) return;
  lastTickAt = nowMs;
  if (typeof secondLeft === "number") lastTickSec = secondLeft;

  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 760 : 520;
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
  const nowMs = Date.now();
  if (nowMs - lastStartAt < START_GAP_MS) return;
  lastStartAt = nowMs;

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
function playRestCompleteFallback(ctxOverride?: AudioContext | null): void {
  const ctx = ctxOverride ?? getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const peak = 0.11;
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

function decodeAudioDataCompat(ctx: AudioContext, raw: ArrayBuffer): Promise<AudioBuffer> {
  const copy = raw.slice(0);
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buf: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(buf);
    };
    const fail = (err?: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    try {
      const p = ctx.decodeAudioData(copy, ok, fail);
      if (p && typeof p.then === "function") {
        void p.then(ok, fail);
      }
    } catch (err) {
      fail(err);
    }
  });
}

function decodeSample(src: string): Promise<AudioBuffer | null> {
  const hit = bufferCache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = decodeInFlight.get(src);
  if (pending) return pending;

  const work = (async () => {
    try {
      const ctx = await ensureRunningCtx();
      if (!ctx) return null;
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buf = await decodeAudioDataCompat(ctx, raw);
      bufferCache.set(src, buf);
      return buf;
    } catch {
      return null;
    } finally {
      decodeInFlight.delete(src);
    }
  })();
  decodeInFlight.set(src, work);
  return work;
}

function playDecoded(
  ctx: AudioContext,
  buf: AudioBuffer,
  volume: number,
  token: number,
): boolean {
  try {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const peak = Math.max(0.0001, Math.min(1, volume));
    gain.gain.value = peak;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.onended = () => releaseSampleHold(token);
    src.start();
    const ms = Math.max(500, Math.ceil(buf.duration * 1000) + 80);
    window.setTimeout(() => releaseSampleHold(token), ms);
    return true;
  } catch {
    return false;
  }
}

function playHtmlSample(src: string, volume: number, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Fresh element so a later unlock/preload cannot pause this playback.
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.muted = false;
      audio.volume = Math.max(0, Math.min(1, volume));
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (!ok) resolve(false);
        else resolve(true);
      };
      audio.addEventListener("ended", () => releaseSampleHold(token), { once: true });
      audio.addEventListener("error", () => done(false), { once: true });
      void audio
        .play()
        .then(() => {
          audioUnlocked = true;
          done(true);
        })
        .catch(() => done(false));
      window.setTimeout(() => {
        if (!settled) done(!audio.paused);
      }, 600);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Call from a user gesture (set check, mute toggle, any touch on workout).
 * Resumes AudioContext and decodes the rest-end sample so a later timer
 * (no gesture) can play through Web Audio.
 */
export function unlockRestAudio(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  try {
    const src = restTimerSoundSrc(sound);
    const alt = restTimerSoundFallbackSrc(sound);
    void ensureRunningCtx().then((ctx) => {
      if (ctx) audioUnlocked = true;
    });
    void decodeSample(src);
    if (alt && alt !== src) void decodeSample(alt);
  } catch {
    /* ignore */
  }
}

/** Resume the audio context + keep the sample decoded during the last seconds of rest. */
export function warmRestAudio(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  unlockRestAudio(sound);
}

export function isRestAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * End-of-rest alert — coach-selected sample (default Cybertruck honk).
 * Guarded so live retargets / dual clients don't stack chirps/horns.
 * Pass `{ force: true }` for the real countdown-zero path so de-dupe never swallows it.
 *
 * Plays the decoded buffer through AudioContext first (works after a set-tap
 * unlock even when iOS blocks timer-driven HTMLAudio). HTMLAudio is second.
 * Oscillator buzz is last — and it always runs if neither sample actually starts.
 */
export function playRestComplete(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
  opts?: { force?: boolean },
): void {
  if (typeof window === "undefined") return;
  const nowMs = Date.now();
  if (!opts?.force) {
    if (completeInFlight) return;
    if (nowMs - lastCompleteAt < COMPLETE_GAP_MS) return;
  }
  lastCompleteAt = nowMs;
  completeInFlight = true;
  window.setTimeout(() => {
    completeInFlight = false;
  }, COMPLETE_GAP_MS);

  const id = normalizeRestTimerSound(sound);
  const primarySrc = restTimerSoundSrc(id);
  const fallbackSrc = restTimerSoundFallbackSrc(id);
  const volume = restTimerSoundVolume(id);

  sampleRelease?.();
  const token = ++sampleReleaseToken;
  sampleRelease = holdBackgroundMusicForMedia();

  void (async () => {
    try {
      const ctx = await ensureRunningCtx();
      const tryBuf = async (src: string | null): Promise<boolean> => {
        if (!src || !ctx) return false;
        const buf = bufferCache.get(src) ?? (await decodeSample(src));
        return Boolean(buf && playDecoded(ctx, buf, volume, token));
      };

      if (await tryBuf(primarySrc)) {
        audioUnlocked = true;
        return;
      }
      if (fallbackSrc && (await tryBuf(fallbackSrc))) {
        audioUnlocked = true;
        return;
      }
      if (await playHtmlSample(primarySrc, volume, token)) return;
      if (fallbackSrc && fallbackSrc !== primarySrc) {
        if (await playHtmlSample(fallbackSrc, volume, token)) return;
      }
      playRestCompleteFallback(ctx);
    } catch {
      playRestCompleteFallback();
    }
  })();
}

/** Preload / decode chosen sample so the first rest-end isn't delayed. */
export function preloadRestCompleteSound(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  try {
    const src = restTimerSoundSrc(sound);
    const alt = restTimerSoundFallbackSrc(sound);
    void decodeSample(src);
    if (alt && alt !== src) void decodeSample(alt);
  } catch {
    /* ignore */
  }
}
