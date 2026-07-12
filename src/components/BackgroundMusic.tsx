"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BG_MUSIC_OVERLAY_EVENT,
  markBackgroundMusicElement,
  registerBackgroundMusicMediaDucking,
} from "@/lib/background-music-control";

/**
 * Site-wide background music + pointing-finger guide.
 *
 * Finger appears for at least 20s and we start music in the same beat.
 * Browsers may block *audible* autoplay; we then buffer muted and unmute on
 * the first real gesture so sound still kicks in without hunting for the button.
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.55;
const OFF_KEY = "ts-bg-music-muted"; // "1" = user explicitly muted
/** At least 20 seconds of finger visible. */
const HINT_MS = 22_000;

const ACTIVATION_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "touchstart",
  "click",
];

const ADMIN_MUSIC_LANDING = new Set(["/admin", "/admin/day"]);

function isAdminSubPage(pathname: string): boolean {
  return pathname.startsWith("/admin") && !ADMIN_MUSIC_LANDING.has(pathname);
}

function isUserMuted(): boolean {
  try {
    return window.localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export default function BackgroundMusic() {
  const pathname = usePathname() ?? "";
  const adminSubPage = isAdminSubPage(pathname);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overlayPauseRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);
  const unlockAttemptedRef = useRef(false);

  /** Explicit user mute (speaker button). */
  const [off, setOff] = useState(false);
  /** True when browser is only allowing muted playback until a gesture. */
  const [awaitingGesture, setAwaitingGesture] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  /** Finger stays up for HINT_MS — restarted whenever we intentionally re-show. */
  const showFingerForAtLeastTwentySeconds = useCallback(() => {
    setShowHint(true);
    clearHintTimer();
    hintTimerRef.current = window.setTimeout(() => {
      setShowHint(false);
      hintTimerRef.current = null;
    }, HINT_MS);
  }, [clearHintTimer]);

  const dismissHint = useCallback(() => {
    clearHintTimer();
    setShowHint(false);
  }, [clearHintTimer]);

  const forceAudible = useCallback(async (audio: HTMLAudioElement) => {
    if (isUserMuted() || overlayPauseRef.current) return false;
    audio.volume = VOLUME;
    audio.muted = false;
    try {
      // Restart from pause if needed so unmute actually produces sound
      if (audio.paused) {
        await audio.play();
      } else {
        // Some engines need play() again after unmuting
        await audio.play();
      }
      setAwaitingGesture(false);
      setOff(false);
      return !audio.muted && !audio.paused;
    } catch {
      return false;
    }
  }, []);

  const whenCanPlay = (audio: HTMLAudioElement, ms = 8000) =>
    new Promise<void>((resolve) => {
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener("canplay", finish);
        audio.removeEventListener("canplaythrough", finish);
        audio.removeEventListener("loadeddata", finish);
        resolve();
      };
      audio.addEventListener("canplay", finish);
      audio.addEventListener("canplaythrough", finish);
      audio.addEventListener("loadeddata", finish);
      try {
        if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          audio.load();
        }
      } catch {
        /* ignore */
      }
      window.setTimeout(finish, ms);
    });

  /**
   * Finger + music together. Prefer real sound; fall back to muted buffer + gesture unlock.
   */
  const startMusicWithFinger = useCallback(
    async (audio: HTMLAudioElement) => {
      if (isUserMuted()) {
        setOff(true);
        showFingerForAtLeastTwentySeconds();
        return;
      }

      showFingerForAtLeastTwentySeconds();
      setOff(false);

      audio.loop = true;
      audio.preload = "auto";
      audio.defaultMuted = false;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      try {
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      } catch {
        /* ignore */
      }
      audio.volume = VOLUME;

      await whenCanPlay(audio);

      // --- Audible attempts (several quick retries) ---
      for (let i = 0; i < 4; i++) {
        audio.muted = false;
        audio.volume = VOLUME;
        try {
          await audio.play();
          if (!audio.paused && !audio.muted) {
            setAwaitingGesture(false);
            return;
          }
        } catch {
          /* keep trying */
        }
        await new Promise((r) => window.setTimeout(r, 200 * (i + 1)));
      }

      // --- Muted buffer so the next gesture only has to unmute ---
      audio.muted = true;
      try {
        await audio.play();
        setAwaitingGesture(true);
      } catch {
        setAwaitingGesture(true);
      }
    },
    [showFingerForAtLeastTwentySeconds],
  );

  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  // Mount: finger + music
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);

    void startMusicWithFinger(audio);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (isUserMuted() || overlayPauseRef.current) return;
      void forceAudible(audio);
    };
    const onPageShow = () => {
      if (isUserMuted()) return;
      void startMusicWithFinger(audio);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      clearHintTimer();
    };
  }, [startMusicWithFinger, forceAudible, clearHintTimer]);

  // Any real gesture → unlock audible music (finger stays for the full 20s+)
  useEffect(() => {
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const onActivation = () => {
      const audio = audioRef.current;
      if (!audio || isUserMuted() || overlayPauseRef.current) return;
      void forceAudible(audio).then((ok) => {
        if (ok) unlockAttemptedRef.current = true;
      });
    };

    ACTIVATION_EVENTS.forEach((e) => window.addEventListener(e, onActivation, opts));
    return () => {
      ACTIVATION_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivation, opts),
      );
    };
  }, [forceAudible]);

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
      if (!isUserMuted()) void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
  }, [forceAudible]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (adminSubPage || overlayPauseRef.current) {
      audio.pause();
      return;
    }
    if (isUserMuted()) {
      setOff(true);
      return;
    }
    void startMusicWithFinger(audio);
  }, [adminSubPage, startMusicWithFinger]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !off;
    setOff(next);
    try {
      window.localStorage.setItem(OFF_KEY, next ? "1" : "0");
    } catch {
      /* private mode edge cases */
    }
    if (next) {
      dismissHint();
      setAwaitingGesture(false);
      audio.muted = true;
      audio.pause();
    } else {
      // Unmute button = explicit gesture → should allow audible play
      void startMusicWithFinger(audio).then(() => forceAudible(audio));
    }
  };

  const onAdminLanding = ADMIN_MUSIC_LANDING.has(pathname);
  const onPublicHome = pathname === "/";
  const fingerVisible = showHint && !adminSubPage;
  /** Speaker icon: “on” only when we believe sound can be heard */
  const showAsPlaying = !off && !awaitingGesture;

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
                ? "bottom-[5.75rem] sm:bottom-28"
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
          {fingerVisible ? (
            <div className="bg-music-guide" role="status" aria-live="polite">
              <p className="bg-music-guide-bubble">
                <span className="sm:hidden">
                  {off
                    ? "Tap speaker for music"
                    : awaitingGesture
                      ? "Tap anywhere for sound"
                      : "Music on — tap to mute"}
                </span>
                <span className="hidden sm:inline">
                  {off
                    ? "Click the speaker to play music."
                    : awaitingGesture
                      ? "Tap or click anywhere to start the sound."
                      : "Music is on — click to mute anytime."}
                </span>
              </p>
              {/* 👉 medium skin (one shade lighter than medium-dark) → 👉🏽 */}
              <span className="bg-music-guide-pointer" aria-hidden>
                {"\u{1F449}\u{1F3FD}"}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={
              off || awaitingGesture
                ? "Play background music"
                : "Mute background music"
            }
            title={off || awaitingGesture ? "Play music" : "Mute music"}
            className="bg-music-toggle relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985]"
          >
            {showAsPlaying ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
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
