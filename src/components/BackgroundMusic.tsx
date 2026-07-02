"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BG_MUSIC_OVERLAY_EVENT } from "@/lib/background-music-control";

/**
 * Site-wide background music.
 *
 * Mounted once in the root layout so it survives client-side navigation —
 * the song keeps playing uninterrupted as visitors move between pages.
 *
 * Fast-start strategy: browsers block *audible* autoplay until a user gesture,
 * but they DO allow *muted* autoplay. So we start the track muted and playing
 * on load (it buffers silently in the background); on the visitor's first
 * interaction we simply unmute, so sound comes in instantly with no load lag.
 * A floating toggle turns it on/off, and that choice is remembered across
 * full page reloads via localStorage.
 */

const SRC = "/background-music.mp3";
const OFF_KEY = "ts-bg-music-muted"; // "1" = visitor turned music off

/** Coach admin landing — keep the welcome track; deeper admin pages stay quiet. */
const ADMIN_MUSIC_LANDING = new Set(["/admin", "/admin/day"]);

function isAdminSubPage(pathname: string): boolean {
  return pathname.startsWith("/admin") && !ADMIN_MUSIC_LANDING.has(pathname);
}

export default function BackgroundMusic() {
  const pathname = usePathname() ?? "";
  const adminSubPage = isAdminSubPage(pathname);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overlayPauseRef = useRef(false);
  // `off` = the visitor's on/off choice (not the same as the silent-buffering
  // mute used purely for fast start). Default on; reconciled with storage below.
  const [off, setOff] = useState(false);

  // Start muted-and-playing on load so the file buffers immediately, and
  // restore a prior "off" choice.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const wasOff = window.localStorage.getItem(OFF_KEY) === "1";
    if (wasOff) {
      setOff(true);
      return; // visitor turned it off before — stay silent.
    }

    // Buffer + play silently right away (allowed because it's muted).
    audio.muted = true;
    audio.play().catch(() => {
      // If even muted autoplay is blocked, the first-interaction handler and
      // the toggle button are the fallbacks.
    });
  }, []);

  // On the first user gesture, unmute so audible sound starts instantly.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let done = false;
    const onFirstGesture = () => {
      if (done) return;
      done = true;
      if (window.localStorage.getItem(OFF_KEY) !== "1") {
        audio.muted = false;
        // Ensure it's actually rolling (covers the blocked-muted-autoplay case).
        audio.play().catch(() => {});
      }
      remove();
    };

    const events: (keyof DocumentEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    const remove = () =>
      events.forEach((e) => window.removeEventListener(e, onFirstGesture));
    events.forEach((e) =>
      window.addEventListener(e, onFirstGesture, { passive: true })
    );

    return remove;
  }, []);

  // Video overlays (free-ticket prank, etc.) duck the site music.
  useEffect(() => {
    const onOverlay = (e: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active);
      overlayPauseRef.current = active;
      if (active) {
        audio.pause();
        return;
      }
      if (!off && window.localStorage.getItem(OFF_KEY) !== "1") {
        audio.muted = false;
        audio.play().catch(() => {});
      }
    };
    window.addEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
  }, [off]);

  // Hide the control and pause on admin sub-pages (queue, members, settings, etc.).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (adminSubPage || overlayPauseRef.current) {
      audio.pause();
      return;
    }
    if (!off && window.localStorage.getItem(OFF_KEY) !== "1") {
      audio.muted = false;
      audio.play().catch(() => {});
    }
  }, [adminSubPage, off]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !off;
    setOff(next);
    window.localStorage.setItem(OFF_KEY, next ? "1" : "0");
    if (next) {
      audio.pause();
    } else {
      audio.muted = false;
      audio.play().catch(() => {});
    }
  };

  const onAdminLanding = ADMIN_MUSIC_LANDING.has(pathname);

  return (
    <>
      <audio ref={audioRef} src={SRC} loop preload="auto" />
      {!adminSubPage ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={off ? "Unmute background music" : "Mute background music"}
          title={off ? "Play music" : "Mute music"}
          className={`bg-music-toggle fixed z-50 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985] ${
            onAdminLanding ? "bottom-20 xl:bottom-6" : "bottom-6"
          }`}
          style={{
            right: "max(1.5rem, env(safe-area-inset-right))",
            bottom: onAdminLanding
              ? undefined
              : "max(1.5rem, env(safe-area-inset-bottom))",
          }}
        >
          {off ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        </button>
      ) : null}
    </>
  );
}

function SpeakerOnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
