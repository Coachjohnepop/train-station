"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import { FREE_TICKET_FULL_SRC } from "@/lib/landing-media";

export const FREE_TICKET_GAG_HOST_ID = "ts-free-ticket-gag-host";
export const FREE_TICKET_GAG_VIDEO_ID = "ts-free-ticket-gag-video";

let releaseBg: (() => void) | null = null;
let playLock = false;

function gagVideo(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(FREE_TICKET_GAG_VIDEO_ID) as HTMLVideoElement | null;
}

/** Strip every native transport control iOS/Safari likes to draw (skip, mute, AirPlay). */
export function stripNativeVideoChrome(el: HTMLVideoElement): void {
  el.controls = false;
  el.removeAttribute("controls");
  el.playsInline = true;
  el.disablePictureInPicture = true;
  try {
    el.disableRemotePlayback = true;
  } catch {
    /* older WebKit */
  }
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.setAttribute("disablepictureinpicture", "");
  el.setAttribute("disableremoteplayback", "");
  el.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback noplaybackrate");
  el.setAttribute("x-webkit-airplay", "deny");
}

function duckThemeSong(): void {
  releaseBg?.();
  releaseBg = holdBackgroundMusicForMedia();
}

function unduckThemeSong(): void {
  releaseBg?.();
  releaseBg = null;
}

/** Warm HTTP cache only. Never play this element. */
export function preloadFreeTicketGag(href: string = FREE_TICKET_FULL_SRC): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-ts-gag-preload="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = href;
  link.setAttribute("data-ts-gag-preload", href);
  document.head.appendChild(link);
}

/**
 * Play the modal’s in-place video once. Must run in the same tap as flushSync(open).
 * Do not create a second <video> or move one — iOS restarts and draws YouTube-like chrome.
 */
export function startFreeTicketGagFromGesture(_host?: HTMLElement | null): void {
  const video = gagVideo();
  if (!video) return;
  if (playLock) return;
  playLock = true;
  stripNativeVideoChrome(video);
  duckThemeSong();
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;
  try {
    video.currentTime = 0;
  } catch {
    /* ignore */
  }
  void video.play().catch(() => {
    playLock = false;
    unduckThemeSong();
  });
}

/** @deprecated Host is the React video. Kept so old callers compile. */
export function attachFreeTicketGag(_host: HTMLElement): void {
  const video = gagVideo();
  if (video) stripNativeVideoChrome(video);
}

export function stopFreeTicketGag(): void {
  playLock = false;
  const el = gagVideo();
  if (el) {
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.volume = 1;
  }
  unduckThemeSong();
}

export function fadeStopFreeTicketGag(durationMs: number): () => void {
  const el = gagVideo();
  if (!el || durationMs <= 0) {
    stopFreeTicketGag();
    return () => {};
  }

  const startVol = el.volume;
  const start = performance.now();
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled || !el) return;
    const t = Math.min(1, (now - start) / durationMs);
    el.volume = startVol * (1 - t);
    if (t < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    stopFreeTicketGag();
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
