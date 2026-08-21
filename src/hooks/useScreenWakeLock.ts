"use client";

import { useEffect } from "react";

const KEEP_AWAKE_SRC = "/videos/keep-awake.mp4";

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

/** iPhone Screen Wake Lock often "succeeds" then the phone still sleeps. */
export function iosNeedsVideoKeepAwake(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  if (/iP(hone|ad|od)/i.test(userAgent)) return true;
  // iPadOS 13+ reports as Macintosh.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Keep the phone screen on while a workout / rest / timed hold is showing.
 * iOS otherwise sleeps during a 5-min bike count (a number on screen is not a movie).
 *
 * Prefers Screen Wake Lock on Android. On iPhone always keep a tiny looping
 * muted video playing — Wake Lock alone does not hold the screen.
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;
    let video: HTMLVideoElement | null = null;

    function stopVideo() {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
      video = null;
    }

    function startVideo() {
      if (video || cancelled) return;
      const el = document.createElement("video");
      el.src = KEEP_AWAKE_SRC;
      el.muted = true;
      el.defaultMuted = true;
      el.loop = true;
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("muted", "");
      el.setAttribute("aria-hidden", "true");
      el.tabIndex = -1;
      Object.assign(el.style, {
        position: "fixed",
        width: "2px",
        height: "2px",
        opacity: "0.01",
        pointerEvents: "none",
        bottom: "0",
        left: "0",
        zIndex: "-1",
      });
      document.body.appendChild(el);
      video = el;
      void el.play().catch(() => {
        /* needs a tap — pointerdown retries lock() */
      });
    }

    async function lock() {
      if (cancelled || document.visibilityState !== "visible") return;
      const ios = iosNeedsVideoKeepAwake(
        navigator.userAgent,
        navigator.maxTouchPoints || 0,
      );
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        };
        if (nav.wakeLock?.request) {
          if (!(sentinel && sentinel.released === false)) {
            sentinel = await nav.wakeLock.request("screen");
            sentinel.addEventListener("release", () => {
              sentinel = null;
              if (!cancelled && document.visibilityState === "visible") {
                void lock();
              }
            });
          }
          if (!ios) {
            stopVideo();
            return;
          }
        }
      } catch {
        /* NotAllowedError until a gesture, or unsupported */
      }
      startVideo();
    }

    function onVisible() {
      if (document.visibilityState === "visible") void lock();
    }

    void lock();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", lock, { passive: true });
    window.addEventListener("pageshow", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", lock);
      window.removeEventListener("pageshow", onVisible);
      void sentinel?.release().catch(() => {});
      sentinel = null;
      stopVideo();
    };
  }, [active]);
}
