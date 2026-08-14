"use client";

import { holdBackgroundMusicForMedia } from "@/lib/background-music-control";
import {
  FREE_TICKET_GAG_AUDIO_SRC,
  FREE_TICKET_GAG_POSTER,
  FREE_TICKET_GAG_SRC,
} from "@/lib/landing-media";

const VIDEO_ID = "ts-free-ticket-gag-video";
const PARK_ID = "ts-free-ticket-gag-park";

let releaseBg: (() => void) | null = null;
let chorus: HTMLAudioElement | null = null;

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

function getChorus(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!chorus) {
    chorus = new Audio(FREE_TICKET_GAG_AUDIO_SRC);
    chorus.preload = "auto";
  }
  return chorus;
}

/** Hidden muted <video> for the picture — audio is the separate mp3. */
export function ensureFreeTicketGagElement(): HTMLVideoElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(VIDEO_ID) as HTMLVideoElement | null;
  if (!el) {
    el = document.createElement("video");
    el.id = VIDEO_ID;
    el.src = FREE_TICKET_GAG_SRC;
    el.poster = FREE_TICKET_GAG_POSTER;
    el.preload = "auto";
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.controls = false;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("title", "You picked free");
    parkHost()?.appendChild(el);
    el.load();
  }
  return el;
}

export function preloadFreeTicketGag(): void {
  getChorus()?.load();
  ensureFreeTicketGagElement();
}

function duckThemeSong(): void {
  releaseBg?.();
  releaseBg = holdBackgroundMusicForMedia();
}

function unduckThemeSong(): void {
  releaseBg?.();
  releaseBg = null;
}

/** Call from the Free tap — unmuted audio is allowed on that gesture. */
export function startFreeTicketGagFromGesture(): void {
  const audio = getChorus();
  const video = ensureFreeTicketGagElement();
  if (audio) {
    audio.currentTime = 0;
    audio.volume = 1;
    duckThemeSong();
    void audio.play().catch(() => {
      unduckThemeSong();
    });
  }
  if (video) {
    video.muted = true;
    video.currentTime = 0;
    void video.play().catch(() => {
      /* poster still shows */
    });
  }
}

export function attachFreeTicketGag(host: HTMLElement): void {
  const el = ensureFreeTicketGagElement();
  if (!el) return;
  el.className = "absolute inset-0 h-full w-full object-contain bg-black";
  el.muted = true;
  if (el.parentElement !== host) host.appendChild(el);
  if (el.paused) {
    void el.play().catch(() => {
      /* muted autoplay or poster */
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
  if (chorus) {
    chorus.pause();
    chorus.currentTime = 0;
    chorus.volume = 1;
  }
  const el =
    typeof document === "undefined"
      ? null
      : (document.getElementById(VIDEO_ID) as HTMLVideoElement | null);
  if (el) {
    el.pause();
    el.currentTime = 0;
    el.muted = true;
  }
  parkFreeTicketGag();
  unduckThemeSong();
}

/** Ramp audio (and muted video) out, then stop. */
export function fadeStopFreeTicketGag(durationMs: number): () => void {
  if (!chorus || durationMs <= 0) {
    stopFreeTicketGag();
    return () => {};
  }

  const startVol = chorus.volume;
  const start = performance.now();
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled || !chorus) return;
    const t = Math.min(1, (now - start) / durationMs);
    chorus.volume = startVol * (1 - t);
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
