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
/**
 * Guide “seen” flag. Bump when the finger should reappear for everyone once.
 * Hint is dismissed only by mute toggle or timeout — never by a random page tap
 * (that was making the finger vanish instantly in private windows).
 */
const HINT_KEY = "ts-bg-music-hint-seen-v4";
/** Keep the purple finger on screen ~20s (mute toggle also dismisses). */
const HINT_MS = 20_000;

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
  // Show the purple finger guide unless this browser already dismissed it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);
    audio.volume = VOLUME;

    const wasOff = window.localStorage.getItem(OFF_KEY) === "1";
    if (wasOff) {
      setOff(true);
      // Still show the guide once so people can find unmute
      if (window.localStorage.getItem(HINT_KEY) !== "1") setShowHint(true);
      return;
    }

    void startMusic(audio);

    if (window.localStorage.getItem(HINT_KEY) !== "1") {
      setShowHint(true);
    }
  }, []);

  // Unmute on the first real user activation (click/tap/key — not scroll).
  // Do NOT dismiss the finger here — any page tap was killing the guide instantly.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onActivation = () => {
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      audio.muted = false;
      void audio
        .play()
        .then(() => {
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

  // Auto-dismiss only after enough time to notice (or when they use the mute button).
  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(dismissHint, HINT_MS);
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
  /** Home has a floating “View memberships” pill at bottom-right — sit above it. */
  const onPublicHome = pathname === "/";

  return (
    <>
      <audio ref={audioRef} src={SRC} loop preload="auto" data-ts-bg-music="true" />
      {!adminSubPage ? (
        <div
          className={`bg-music-control-cluster fixed z-50 flex items-end overflow-visible ${
            onAdminLanding
              ? "bottom-20 xl:bottom-6"
              : onPublicHome
                ? /* Above View memberships: taller on phone for safe-area + FAB */
                  "bottom-[5.75rem] sm:bottom-28"
                : "bottom-6"
          }`}
          style={{
            right: "max(1rem, env(safe-area-inset-right, 0px))",
            bottom:
              onAdminLanding || onPublicHome
                ? undefined
                : "max(1.25rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          {showHint && !off ? (
            <div className="bg-music-guide" role="status" aria-live="polite">
              <p className="bg-music-guide-bubble">
                <span className="sm:hidden">Tap to mute music</span>
                <span className="hidden sm:inline">
                  Click to mute — or just enjoy as you surf.
                </span>
              </p>
              <span className="bg-music-guide-pointer" aria-hidden>
                <PurplePointingFinger />
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={off ? "Unmute background music" : "Mute background music"}
            title={off ? "Play music" : "Mute music"}
            className="bg-music-toggle relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985] sm:h-11 sm:w-11"
          >
            {off ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Brand-purple “👉” — index finger clearly points RIGHT at the speaker.
 */
function PurplePointingFinger() {
  const stroke = "color-mix(in srgb, var(--accent-light, #c4b5fd) 80%, white)";
  return (
    <svg
      className="bg-music-guide-pointer-svg"
      width="76"
      height="76"
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="bg-music-finger-grad"
          x1="16"
          y1="16"
          x2="88"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--accent-hover, #a78bfa)" />
          <stop offset="0.5" stopColor="var(--accent, #7c3aed)" />
          <stop offset="1" stopColor="var(--accent-deep, #5b21b6)" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="54" rx="30" ry="22" fill="var(--accent, #7c3aed)" opacity="0.18" />
      {/* Palm + wrist (left) */}
      <path
        d="M18 44c0-7 5.5-12.5 12.5-12.5H42v8.5c0 2.5-2 4.5-4.5 4.5H30.5C24 44.5 18 50.5 18 58.5v6c0 9 7 16 16 16h18c7.5 0 13.5-5 15.5-12l6-20c1.4-4.5-1.2-9.3-5.8-10.8-3.2-1-6.6.4-8.2 3.2l-2.2 3.8V44H18z"
        fill="url(#bg-music-finger-grad)"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Index finger → right (main readable shape) */}
      <rect
        x="38"
        y="24"
        width="46"
        height="18"
        rx="9"
        fill="url(#bg-music-finger-grad)"
        stroke={stroke}
        strokeWidth="1.6"
      />
      {/* Fingernail tip accent on the right */}
      <path
        d="M76 27.5h2.5c4 0 7.5 3.3 7.5 7.5s-3.5 7.5-7.5 7.5H76V27.5z"
        fill="color-mix(in srgb, var(--accent-light, #c4b5fd) 55%, white)"
        opacity="0.55"
      />
      {/* Middle finger (slightly up, shorter — reads as hand) */}
      <rect
        x="40"
        y="14"
        width="14"
        height="16"
        rx="7"
        fill="url(#bg-music-finger-grad)"
        stroke={stroke}
        strokeWidth="1.4"
      />
      {/* Thumb (angled under index) */}
      <path
        d="M36 48c-1 6 2.5 12 9 14.5 3 1.2 6.2-.4 7.2-3.3l2.5-7.2c1-2.9-.6-6-3.5-7.1-4.5-1.7-13.2-1.5-15.2 3.1z"
        fill="url(#bg-music-finger-grad)"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
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
