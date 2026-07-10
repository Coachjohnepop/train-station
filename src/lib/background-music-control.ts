/** Pause/resume site background music while other audio or video plays. */

export const BG_MUSIC_OVERLAY_EVENT = "ts-bg-music-overlay";
const BG_MUSIC_ATTR = "data-ts-bg-music";

let overlayHold = false;
let externalHoldCount = 0;
const playingMedia = new Set<HTMLMediaElement>();
let listenersRegistered = false;

function shouldPauseBackgroundMusic(): boolean {
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