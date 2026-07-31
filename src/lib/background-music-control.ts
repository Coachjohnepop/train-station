/** Pause/resume site background music while other audio or video plays. */

export const BG_MUSIC_OVERLAY_EVENT = "ts-bg-music-overlay";
/** Ask BackgroundMusic to unlock/play (call from a user gesture when possible). */
export const BG_MUSIC_REQUEST_PLAY_EVENT = "ts-bg-music-request-play";
/**
 * Legacy key — was used to persist mute across visits. We no longer persist mute
 * (landing should always start Theme Song on first tap). Cleared on load.
 */
export const BG_MUSIC_MUTED_KEY = "ts-bg-music-muted";
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

/** @deprecated Mute is session-only now; always returns false after clear. */
export function isBackgroundMusicUserMuted(): boolean {
  return false;
}

/** Drop legacy persisted mute so private/new visits never inherit “muted”. */
export function clearPersistedBackgroundMusicMute(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BG_MUSIC_MUTED_KEY);
    window.sessionStorage.removeItem(BG_MUSIC_MUTED_KEY);
  } catch {
    /* ignore */
  }
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
  if (!(el instanceof HTMLMediaElement) || isBackgroundMusic(el)) return;
  playingMedia.add(el);
  emitPauseState();
}

function onMediaStop(e: Event) {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement) || isBackgroundMusic(el)) return;
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