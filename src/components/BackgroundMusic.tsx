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
 * Autoplay strategy (best-effort under browser policies):
 * 1. HTML autoPlay + try audible play as soon as the file can start
 * 2. If blocked, keep muted playback buffered
 * 3. On first real gesture (tap/click/key), unmute + play immediately
 * User mute choice is remembered in localStorage.
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.5;
const OFF_KEY = "ts-bg-music-muted"; // "1" = visitor turned music off
/**
 * Guide “seen” flag. Bump when the finger should reappear for everyone once.
 * Hint is dismissed only by mute toggle or timeout — never by a random page tap.
 */
const HINT_KEY = "ts-bg-music-hint-seen-v6";
/** Keep the pointing finger on screen ~20s (mute toggle also dismisses). */
const HINT_MS = 20_000;

/** Browsers only honor audio from real activation — scroll does not count. */
const ACTIVATION_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "touchstart",
  "click",
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
    return audio.play().catch(() => false);
  };

  /** Wait until the element can start playback (or timeout). */
  const whenReady = (audio: HTMLAudioElement, ms = 4000) =>
    new Promise<void>((resolve) => {
      if (audio.readyState >= 2) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener("canplay", finish);
        audio.removeEventListener("canplaythrough", finish);
        resolve();
      };
      audio.addEventListener("canplay", finish);
      audio.addEventListener("canplaythrough", finish);
      window.setTimeout(finish, ms);
    });

  /**
   * Prefer audible autoplay. If the browser blocks sound, keep muted playback
   * running so the first gesture can unmute without a second delay.
   */
  const startMusic = async (audio: HTMLAudioElement) => {
    audio.loop = true;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    // iOS quirk: playsInline as property where supported
    try {
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    } catch {
      /* ignore */
    }
    audio.volume = VOLUME;

    await whenReady(audio);

    // Attempt 1: full audible autoplay (works on many desktop + returning visitors)
    audio.muted = false;
    try {
      await audio.play();
      return "audible" as const;
    } catch {
      /* blocked */
    }

    // Attempt 2: muted autoplay (almost always allowed) — buffer until gesture
    audio.muted = true;
    try {
      await audio.play();
    } catch {
      /* still blocked — activation handler will start from zero */
    }
    return "muted-or-blocked" as const;
  };

  // Duck when other trusted media plays (video controls, horn, etc.).
  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  // Autoplay on mount / page show (bfcache restore).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);
    audio.volume = VOLUME;

    const wasOff = window.localStorage.getItem(OFF_KEY) === "1";
    if (wasOff) {
      setOff(true);
      if (window.localStorage.getItem(HINT_KEY) !== "1") setShowHint(true);
      return;
    }

    void startMusic(audio);

    if (window.localStorage.getItem(HINT_KEY) !== "1") {
      setShowHint(true);
    }

    // Retry when tab becomes visible again (common after mobile browser switch)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      if (overlayPauseRef.current) return;
      void resumeAudible(audio);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onVisible();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Unmute + play on the first real user activation (click/tap/key).
  // Do NOT dismiss the finger here.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onActivation = () => {
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      if (overlayPauseRef.current) return;
      audio.volume = VOLUME;
      audio.muted = false;
      void audio.play().then(remove).catch(() => {
        // Keep listening — some browsers need a second gesture
      });
    };

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const remove = () =>
      ACTIVATION_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivation, opts),
      );
    // Capture phase so we win even if a child stops bubbling
    ACTIVATION_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivation, opts),
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
      <audio
        ref={audioRef}
        src={SRC}
        loop
        autoPlay
        preload="auto"
        playsInline
        data-ts-bg-music="true"
      />
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
              {/*
                Real emoji 👉 with medium-dark skin tone (tan, a shade darker).
                U+1F449 + U+1F3FE → 👉🏾 — OS-rendered pointing hand.
              */}
              <span className="bg-music-guide-pointer" aria-hidden>
                {"\u{1F449}\u{1F3FE}"}
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
