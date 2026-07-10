"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BG_MUSIC_OVERLAY_EVENT,
  markBackgroundMusicElement,
  registerBackgroundMusicMediaDucking,
} from "@/lib/background-music-control";

/**
 * Site-wide background music.
 *
 * Mounted once in the root layout so it survives client-side navigation —
 * the song keeps playing uninterrupted as visitors move between pages.
 *
 * Fast-start strategy: try audible autoplay first; if the browser blocks it,
 * fall back to muted buffering until a real activation (click/tap/key — scroll
 * does not count). A floating toggle turns music on/off, remembered in
 * localStorage. First-time visitors see a guided hint pointing at the toggle.
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.5;
const OFF_KEY = "ts-bg-music-muted"; // "1" = visitor turned music off
const HINT_KEY = "ts-bg-music-hint-seen";

/** Browsers only honor audio from real activation — scroll does not count. */
const ACTIVATION_EVENTS: (keyof DocumentEventMap)[] = [
  "pointerdown",
  "keydown",
  "touchstart",
];

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
  const [showHint, setShowHint] = useState(false);

  const dismissHint = () => {
    setShowHint(false);
    window.localStorage.setItem(HINT_KEY, "1");
  };

  const resumeAudible = (audio: HTMLAudioElement) => {
    audio.volume = VOLUME;
    audio.muted = false;
    return audio.play().catch(() => {});
  };

  const startMusic = async (audio: HTMLAudioElement) => {
    audio.volume = VOLUME;
    audio.muted = false;
    try {
      await audio.play();
      return;
    } catch {
      // Fall back to muted autoplay so the track buffers until a real gesture.
      audio.muted = true;
      await audio.play().catch(() => {});
    }
  };

  // Duck when other trusted media plays (video controls, horn, etc.).
  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  // Try audible autoplay on load; fall back to muted buffering. Restore prior off.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);
    audio.volume = VOLUME;

    const wasOff = window.localStorage.getItem(OFF_KEY) === "1";
    if (wasOff) {
      setOff(true);
      return;
    }

    void startMusic(audio);

    const hintSeen = window.localStorage.getItem(HINT_KEY) === "1";
    if (!hintSeen) setShowHint(true);
  }, []);

  // Unmute on the first real user activation (click/tap/key — not scroll).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onActivation = () => {
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      audio.muted = false;
      void audio
        .play()
        .then(() => {
          dismissHint();
          remove();
        })
        .catch(() => {});
    };

    const remove = () =>
      ACTIVATION_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivation)
      );
    ACTIVATION_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivation, { passive: true })
    );

    return remove;
  }, []);

  // Auto-dismiss the guided hint after a few seconds.
  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(dismissHint, 10_000);
    return () => window.clearTimeout(timer);
  }, [showHint]);

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
        void resumeAudible(audio);
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
      void resumeAudible(audio);
    }
  }, [adminSubPage, off]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    dismissHint();
    const next = !off;
    setOff(next);
    window.localStorage.setItem(OFF_KEY, next ? "1" : "0");
    if (next) {
      audio.pause();
    } else {
      void resumeAudible(audio);
    }
  };

  const onAdminLanding = ADMIN_MUSIC_LANDING.has(pathname);

  return (
    <>
      <audio ref={audioRef} src={SRC} loop preload="auto" data-ts-bg-music="true" />
      {!adminSubPage ? (
        <div
          className={`bg-music-control-cluster fixed z-50 flex items-end gap-2 sm:gap-3 ${
            onAdminLanding ? "bottom-20 xl:bottom-6" : "bottom-6"
          }`}
          style={{
            right: "max(1.5rem, env(safe-area-inset-right))",
            bottom: onAdminLanding
              ? undefined
              : "max(1.5rem, env(safe-area-inset-bottom))",
          }}
        >
          {showHint && !off ? (
            <div className="bg-music-guide" role="status" aria-live="polite">
              <p className="bg-music-guide-bubble">
                Click to mute — or just enjoy as you surf.
              </p>
              <span className="bg-music-guide-pointer" aria-hidden>
                👉
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={off ? "Unmute background music" : "Mute background music"}
            title={off ? "Play music" : "Mute music"}
            className="bg-music-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985]"
          >
            {off ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </button>
        </div>
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
