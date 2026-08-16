"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  FREE_TICKET_FULL_SRC,
  FREE_TICKET_GAG_POSTER,
} from "@/lib/landing-media";

const VIDEO_ID = "ts-free-ticket-gag-video";
const PARK_ID = "ts-free-ticket-gag-park";

let releaseBg: (() => void) | null = null;

function parkHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let host = document.getElementById(PARK_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = PARK_ID;
    host.className = "pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
  }
  return host;
}

function duckThemeSong(): void {
  releaseBg?.();
  releaseBg = holdBackgroundMusicForMedia();
}

function unduckThemeSong(): void {
  releaseBg?.();
  releaseBg = null;
}

/** One local file: Never Gonna Give You Up hook, then Jeremy. No YouTube. */
export function ensureFreeTicketGagElement(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(VIDEO_ID) as HTMLVideoElement | null;
  if (!el) {
    el = document.createElement("video");
    el.id = VIDEO_ID;
    el.src = FREE_TICKET_FULL_SRC;
    el.poster = FREE_TICKET_GAG_POSTER;
    el.preload = "auto";
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.controls = true;
    el.muted = false;
    el.defaultMuted = false;
    el.setAttribute("title", "The Train Station — Free ticket");
    parkHost()?.appendChild(el);
    el.load();
  }
  return el;
}

export function preloadFreeTicketGag(): void {
  ensureFreeTicketGagElement();
}

/** Call from the Free tap — unmuted play is allowed on that gesture. */
export function startFreeTicketGagFromGesture(): void {
  const video = ensureFreeTicketGagElement();
  if (!video) return;
  duckThemeSong();
  video.muted = false;
  video.volume = 1;
  video.currentTime = 0;
  void video.play().catch(() => {
    unduckThemeSong();
  });
}

export function attachFreeTicketGag(host: HTMLElement): void {
  const el = ensureFreeTicketGagElement();
  if (!el) return;
  el.className = "absolute inset-0 h-full w-full object-contain bg-black";
  el.muted = false;
  if (el.parentElement !== host) host.appendChild(el);
  if (el.paused) {
    void el.play().catch(() => {
      /* need the Free tap gesture */
    });
  }
}

export function parkFreeTicketGag(): void {
  const el =
    typeof document === "undefined"
      ? null
      : (document.getElementById(VIDEO_ID) as HTMLVideoElement | null);
  const host = parkHost();
  if (el && host && el.parentElement !== host) {
    el.className = "";
    host.appendChild(el);
  }
}

export function stopFreeTicketGag(): void {
  const el =
    typeof document === "undefined"
      ? null
      : (document.getElementById(VIDEO_ID) as HTMLVideoElement | null);
  if (el) {
    el.pause();
    el.currentTime = 0;
    el.volume = 1;
  }
  parkFreeTicketGag();
  unduckThemeSong();
}

/** Ramp the one-file player out, then stop. */
export function fadeStopFreeTicketGag(durationMs: number): () => void {
  const el =
    typeof document === "undefined"
      ? null
      : (document.getElementById(VIDEO_ID) as HTMLVideoElement | null);
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
