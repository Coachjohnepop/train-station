/** Pause/resume site background music while other audio or video plays. */

import { isMixAudioElement } from "@/lib/landing-mix-audio";

export const BG_MUSIC_OVERLAY_EVENT = "ts-bg-music-overlay";
/** Ask BackgroundMusic to unlock/play (call from a user gesture when possible). */
export const BG_MUSIC_REQUEST_PLAY_EVENT = "ts-bg-music-request-play";
/** Session mute — once they mute, Theme Song stays off until the tab closes. */
export const BG_MUSIC_MUTED_KEY = "ts-bg-music-muted";
/** Session flag — Theme Song already played once this tab (legacy boolean). */
export const BG_MUSIC_PLAYED_KEY = "ts-bg-music-played";
/** How many silence-starts have been used this tab. */
export const BG_MUSIC_UNLOCK_COUNT_KEY = "ts-bg-music-unlock-count";
const BG_MUSIC_ATTR = "data-ts-bg-music";

let overlayHold = false;
let externalHoldCount = 0;
const playingMedia = new Set<HTMLMediaElement>();
let listenersRegistered = false;

function shouldPauseBackgroundMusic(): boolean {
  // Prune detached media that never fired pause/ended
  for (const el of [...playingMedia]) {
    if (!el.isConnected || el.paused || el.ended) playingMedia.delete(el);
  }
  return overlayHold || externalHoldCount > 0 || playingMedia.size > 0;
}

function emitPauseState(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BG_MUSIC_OVERLAY_EVENT, {
      detail: { active: shouldPauseBackgroundMusic() },
    }),
  );
}

export function setBackgroundMusicOverlay(active: boolean): void {
  if (typeof window === "undefined") return;
  overlayHold = active;
  emitPauseState();
}

/**
 * Drop all ducking holds (overlays, leaked video holds) so theme song can play.
 * Does not override the user’s explicit mute preference (handled in BackgroundMusic).
 */
export function clearBackgroundMusicHolds(): void {
  if (typeof window === "undefined") return;
  overlayHold = false;
  externalHoldCount = 0;
  playingMedia.clear();
  emitPauseState();
}

/**
 * Clear holds + ask the player to start. Safe to call from Free Quick Tour open
 * (same click that unlocks autoplay).
 */
export function requestBackgroundMusicPlay(): void {
  if (typeof window === "undefined") return;
  clearBackgroundMusicHolds();
  window.dispatchEvent(new CustomEvent(BG_MUSIC_REQUEST_PLAY_EVENT));
}

export function isBackgroundMusicUserMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(BG_MUSIC_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistBackgroundMusicMute(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.sessionStorage.setItem(BG_MUSIC_MUTED_KEY, "1");
    else window.sessionStorage.removeItem(BG_MUSIC_MUTED_KEY);
    window.localStorage.removeItem(BG_MUSIC_MUTED_KEY);
  } catch {
    /* ignore */
  }
}

export function isBackgroundMusicAlreadyPlayed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(BG_MUSIC_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistBackgroundMusicPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BG_MUSIC_PLAYED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function getBackgroundMusicUnlockCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(BG_MUSIC_UNLOCK_COUNT_KEY);
    const n = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    if (window.sessionStorage.getItem(BG_MUSIC_PLAYED_KEY) === "1") return 1;
  } catch {
    /* ignore */
  }
  return 0;
}

export function persistBackgroundMusicUnlockCount(count: number): void {
  if (typeof window === "undefined") return;
  const n = Math.max(0, Math.floor(count));
  try {
    window.sessionStorage.setItem(BG_MUSIC_UNLOCK_COUNT_KEY, String(n));
    if (n > 0) window.sessionStorage.setItem(BG_MUSIC_PLAYED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @deprecated Mute is session-sticky now; use persistBackgroundMusicMute(false). */
export function clearPersistedBackgroundMusicMute(): void {
  persistBackgroundMusicMute(false);
}

/** Hold BG music paused until the returned release function runs (YouTube overlays, etc.). */
export function holdBackgroundMusicForMedia(): () => void {
  if (typeof window === "undefined") return () => {};
  externalHoldCount += 1;
  emitPauseState();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    externalHoldCount = Math.max(0, externalHoldCount - 1);
    emitPauseState();
  };
}

export function markBackgroundMusicElement(el: HTMLAudioElement): void {
  el.setAttribute(BG_MUSIC_ATTR, "true");
}

function isBackgroundMusic(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLMediaElement && el.getAttribute(BG_MUSIC_ATTR) === "true"
  );
}

function onMediaPlay(e: Event) {
  if (!e.isTrusted) return;
  const el = e.target;
  if (!(el instanceof HTMLMediaElement) || isBackgroundMusic(el) || isMixAudioElement(el)) {
    return;
  }
  playingMedia.add(el);
  emitPauseState();
}

function onMediaStop(e: Event) {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement) || isBackgroundMusic(el) || isMixAudioElement(el)) {
    return;
  }
  playingMedia.delete(el);
  emitPauseState();
}

/** Duck BG music when the visitor plays native <audio>/<video> (trusted play events). */
export function registerBackgroundMusicMediaDucking(): () => void {
  if (typeof window === "undefined" || listenersRegistered) return () => {};
  listenersRegistered = true;
  const opts: AddEventListenerOptions = { capture: true };
  document.addEventListener("play", onMediaPlay, opts);
  document.addEventListener("pause", onMediaStop, opts);
  document.addEventListener("ended", onMediaStop, opts);
  return () => {
    listenersRegistered = false;
    document.removeEventListener("play", onMediaPlay, opts);
    document.removeEventListener("pause", onMediaStop, opts);
    document.removeEventListener("ended", onMediaStop, opts);
    playingMedia.clear();
    emitPauseState();
  };
}