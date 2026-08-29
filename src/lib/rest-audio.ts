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
/** Primed HTMLAudio per src — iOS only unlocks the same element later. */
const sampleCache = new Map<string, HTMLAudioElement>();
let sampleRelease: (() => void) | null = null;
let sampleReleaseToken = 0;
/** Bumped when rest-end HTMLAudio actually starts so a late unlock pause cannot kill it. */
let htmlPlayGeneration = 0;
/** True after a user-gesture unlock succeeded (iOS / Safari autoplay). */
let audioUnlocked = false;
/** Srcs whose HTMLAudio element already got a silent unmuted prime this page life. */
const htmlPrimedSrcs = new Set<string>();
let ctxResumeListenersBound = false;

/**
 * Unmuted but inaudible. iOS will not later-play an element that was only
 * primed while `muted` — but volume 0.01 of the Cybertruck horn is a chirp
 * on phone speakers when you touch Today to scroll.
 */
const HTML_PRIME_VOLUME = 0.0001;

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

function isRunningCtx(ctx: AudioContext | null | undefined): ctx is AudioContext {
  return Boolean(ctx && ctx.state === "running");
}

function bindCtxResumeListeners(): void {
  if (ctxResumeListenersBound || typeof document === "undefined") return;
  ctxResumeListenersBound = true;
  const kick = () => {
    if (audioCtx && audioCtx.state !== "running") {
      void audioCtx.resume().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  window.addEventListener("pageshow", kick);
  window.addEventListener("focus", kick);
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      bindCtxResumeListeners();
    }
    if (audioCtx.state !== "running") {
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
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  return ctx;
}

/** Must run in the same turn as a user gesture — a later .then() loses iOS unlock. */
function primeWebAudioUnlock(ctx: AudioContext): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
    if (ctx.state === "running") audioUnlocked = true;
  } catch {
    /* ignore */
  }
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
  if (!isRunningCtx(ctx)) return;
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

function configureHtmlAudio(audio: HTMLAudioElement): void {
  audio.preload = "auto";
  audio.muted = false;
  try {
    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  } catch {
    /* older WebKit */
  }
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
}

function sampleHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let host = document.getElementById("ts-rest-audio-host");
  if (host) return host;
  host = document.createElement("div");
  host.id = "ts-rest-audio-host";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  return host;
}

function getOrCreateSample(src: string): HTMLAudioElement {
  let audio = sampleCache.get(src);
  if (audio) return audio;
  audio = new Audio(src);
  configureHtmlAudio(audio);
  try {
    sampleHost()?.appendChild(audio);
  } catch {
    /* ignore */
  }
  audio.addEventListener("error", () => {
    if (sampleCache.get(src) === audio) sampleCache.delete(src);
  });
  sampleCache.set(src, audio);
  return audio;
}

function preferPlaybackSession(): void {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type?: string } }
    ).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    /* Safari < 16.4 */
  }
}

/**
 * Silent HTMLAudio play during a user gesture. iOS only lets a later timer
 * call play() on THIS same element.
 */
function primeHtmlSample(src: string, volume: number): void {
  try {
    const audio = getOrCreateSample(src);
    configureHtmlAudio(audio);
    // Real rest-end already playing — don't steal it.
    if (!audio.paused && !audio.muted && audio.volume > 0.05) return;
    // Already unlocked this clip; another tap/scroll must not replay it.
    if (htmlPrimedSrcs.has(src) && audio.paused) return;
    // Silent prime already in flight.
    if (!audio.paused && audio.volume <= 0.05) return;
    const gen = htmlPlayGeneration;
    // iOS: muted+pause can mark the element as never-unlocked for later timer play().
    // Unmuted + inaudible volume is what later rest-end needs — not the horn at 1%.
    audio.muted = false;
    audio.volume = HTML_PRIME_VOLUME;
    void audio
      .play()
      .then(() => {
        if (gen !== htmlPlayGeneration) return;
        window.setTimeout(() => {
          if (gen !== htmlPlayGeneration) return;
          if (!audio.paused && audio.volume > 0.05) {
            htmlPrimedSrcs.add(src);
            audioUnlocked = true;
            return;
          }
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            /* ignore */
          }
          audio.muted = false;
          audio.volume = volume;
          htmlPrimedSrcs.add(src);
          audioUnlocked = true;
        }, 60);
      })
      .catch(() => {
        /* gesture unlock failed */
      });
  } catch {
    /* ignore */
  }
}

function playDecoded(
  ctx: AudioContext,
  buf: AudioBuffer,
  volume: number,
  token: number,
): boolean {
  // BufferSource.start() does not throw on a suspended/interrupted context —
  // it just plays into silence. Treat that as failure so HTMLAudio can run.
  if (!isRunningCtx(ctx)) return false;
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
      const audio = getOrCreateSample(src);
      configureHtmlAudio(audio);
      htmlPlayGeneration += 1;
      audio.muted = false;
      audio.volume = Math.max(0, Math.min(1, volume));
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      audio.addEventListener("ended", () => releaseSampleHold(token), { once: true });
      audio.addEventListener("error", () => done(false), { once: true });
      void audio
        .play()
        .then(() => {
          if (audio.paused || audio.muted) {
            done(false);
            return;
          }
          audioUnlocked = true;
          htmlPrimedSrcs.add(src);
          done(true);
        })
        .catch(() => done(false));
      window.setTimeout(() => {
        if (!settled) done(!audio.paused && !audio.muted);
      }, 600);
    } catch {
      resolve(false);
    }
  });
}

function buzzFallback(ctx: AudioContext | null | undefined): void {
  if (isRunningCtx(ctx)) {
    playRestCompleteFallback(ctx);
    return;
  }
  playRestCompleteFallback();
}

function pulseRestVibrate(): void {
  try {
    navigator.vibrate?.([220, 80, 220]);
  } catch {
    /* ignore */
  }
}

/**
 * Call from a user gesture (set check, mute toggle, any touch on workout).
 * Sync-resumes Web Audio and silently primes HTMLAudio so a later timer
 * (no gesture) can play the Cybertruck on iOS / Safari.
 */
export function unlockRestAudio(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  try {
    preferPlaybackSession();
    const ctx = getCtx();
    if (ctx) primeWebAudioUnlock(ctx);
    const src = restTimerSoundSrc(sound);
    const alt = restTimerSoundFallbackSrc(sound);
    const volume = restTimerSoundVolume(sound);
    primeHtmlSample(src, volume);
    if (alt && alt !== src) primeHtmlSample(alt, volume);
    void decodeSample(src);
    if (alt && alt !== src) void decodeSample(alt);
  } catch {
    /* ignore */
  }
}

/**
 * Timer-safe warm: resume + decode only. Do not HTML-prime here — a muted
 * play/pause in the last seconds of rest used to cancel the actual horn.
 */
export function warmRestAudio(
  sound: RestTimerSoundId | string | null | undefined = DEFAULT_REST_TIMER_SOUND,
): void {
  if (typeof window === "undefined") return;
  try {
    void ensureRunningCtx();
    const src = restTimerSoundSrc(sound);
    const alt = restTimerSoundFallbackSrc(sound);
    void decodeSample(src);
    if (alt && alt !== src) void decodeSample(alt);
  } catch {
    /* ignore */
  }
}

export function isRestAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * End-of-rest alert — coach-selected sample (default Cybertruck honk).
 * Guarded so live retargets / dual clients don't stack chirps/horns.
 * Pass `{ force: true }` for the real countdown-zero path so de-dupe never swallows it.
 *
 * Primed HTMLAudio first — Web Audio can report "running" after Zoom/iOS
 * interrupt and play the buffer into silence, which used to skip the horn.
 * Oscillator buzz is last.
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

  preferPlaybackSession();
  sampleRelease?.();
  const token = ++sampleReleaseToken;
  sampleRelease = holdBackgroundMusicForMedia();
  pulseRestVibrate();

  void (async () => {
    try {
      if (await playHtmlSample(primarySrc, volume, token)) return;
      if (fallbackSrc && fallbackSrc !== primarySrc) {
        if (await playHtmlSample(fallbackSrc, volume, token)) return;
      }

      const ctx = await ensureRunningCtx();
      const tryBuf = async (src: string | null): Promise<boolean> => {
        if (!src || !ctx || !isRunningCtx(ctx)) return false;
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
      buzzFallback(ctx);
    } catch {
      buzzFallback(audioCtx);
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
    getOrCreateSample(src);
    if (alt && alt !== src) getOrCreateSample(alt);
    void decodeSample(src);
    if (alt && alt !== src) void decodeSample(alt);
  } catch {
    /* ignore */
  }
}
