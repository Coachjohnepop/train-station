"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Site-wide background music.
 *
 * Mounted once in the root layout so it survives client-side navigation —
 * the song keeps playing uninterrupted as visitors move between pages.
 *
 * Browsers block audio-with-sound from autoplaying on load, so playback is
 * armed to begin on the visitor's first interaction (click / tap / scroll /
 * key press). A floating toggle lets them mute it; the muted choice is
 * remembered across full page reloads via localStorage.
 */

const SRC = "/background-music.mp3";
const MUTE_KEY = "ts-bg-music-muted";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Default to playing (un-muted). Hydration starts here; we reconcile with
  // the stored preference in the effect below to avoid an SSR mismatch.
  const [muted, setMuted] = useState(false);

  // Restore the visitor's prior mute choice.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(MUTE_KEY) === "1") {
      setMuted(true);
    }
  }, []);

  // Arm playback on the first user gesture (required by autoplay policies).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      // Respect a stored mute preference, but still "start" so unmuting later
      // resumes instantly.
      if (window.localStorage.getItem(MUTE_KEY) !== "1") {
        audio.play().catch(() => {
          // If the browser still refuses, the toggle button remains a manual
          // fallback the visitor can press.
        });
      }
      removeListeners();
    };

    const events: (keyof DocumentEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    const removeListeners = () => {
      events.forEach((e) => window.removeEventListener(e, start));
    };
    events.forEach((e) =>
      window.addEventListener(e, start, { passive: true, once: false })
    );

    return removeListeners;
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    if (next) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  return (
    <>
      <audio ref={audioRef} src={SRC} loop preload="auto" />
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Unmute background music" : "Mute background music"}
        title={muted ? "Play music" : "Mute music"}
        className="fixed bottom-6 left-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#3d2660] bg-[#0a0612]/90 text-white shadow-xl backdrop-blur-md transition-all hover:border-[#7c3aed] hover:bg-[#1a1428] active:scale-[0.985]"
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </button>
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
