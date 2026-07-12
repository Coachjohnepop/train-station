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
 * When the finger appears we also start music (autoplay best-effort).
 * Finger stays up ~20s or until mute is tapped.
 * Mute preference is remembered; the finger guide is NOT permanently
 * suppressed by localStorage (that made it “disappear” for testers).
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.5;
const OFF_KEY = "ts-bg-music-muted"; // "1" = visitor turned music off
const HINT_MS = 20_000;

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

export default function BackgroundMusic() {
  const pathname = usePathname() ?? "";
  const adminSubPage = isAdminSubPage(pathname);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overlayPauseRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);

  const [off, setOff] = useState(false);
  // Start true so the finger paints immediately; mount effect restarts the 20s window.
  const [showHint, setShowHint] = useState(true);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const showFingerForTwentySeconds = useCallback(() => {
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

  const resumeAudible = useCallback((audio: HTMLAudioElement) => {
    audio.volume = VOLUME;
    audio.muted = false;
    return audio.play().catch(() => false);
  }, []);

  const whenReady = (audio: HTMLAudioElement, ms = 5000) =>
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
        audio.removeEventListener("loadeddata", finish);
        resolve();
      };
      audio.addEventListener("canplay", finish);
      audio.addEventListener("loadeddata", finish);
      // Kick load
      try {
        audio.load();
      } catch {
        /* ignore */
      }
      window.setTimeout(finish, ms);
    });

  /**
   * Start music in tandem with the finger. Audible first; muted buffer if blocked.
   */
  const startMusicWithFinger = useCallback(
    async (audio: HTMLAudioElement) => {
      // Finger + music together
      showFingerForTwentySeconds();

      audio.loop = true;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      try {
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      } catch {
        /* ignore */
      }
      audio.volume = VOLUME;

      await whenReady(audio);

      audio.muted = false;
      try {
        await audio.play();
        return;
      } catch {
        /* browser blocked audible autoplay */
      }

      // Keep track running muted so the next gesture can unmute instantly
      audio.muted = true;
      try {
        await audio.play();
      } catch {
        /* activation handler will start cold */
      }
    },
    [showFingerForTwentySeconds],
  );

  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  // Mount: restore mute preference; start music + finger together.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);

    const wasOff = window.localStorage.getItem(OFF_KEY) === "1";
    if (wasOff) {
      setOff(true);
      // Still show finger so they know where unmute is
      showFingerForTwentySeconds();
      return;
    }

    void startMusicWithFinger(audio);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      if (overlayPauseRef.current) return;
      void resumeAudible(audio);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        if (window.localStorage.getItem(OFF_KEY) === "1") return;
        void startMusicWithFinger(audio);
      } else {
        onVisible();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      clearHintTimer();
    };
  }, [startMusicWithFinger, showFingerForTwentySeconds, resumeAudible, clearHintTimer]);

  // First gesture → unmute + play (does not hide finger).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const onActivation = () => {
      if (window.localStorage.getItem(OFF_KEY) === "1") return;
      if (overlayPauseRef.current) return;
      audio.volume = VOLUME;
      audio.muted = false;
      void audio.play().catch(() => {});
    };

    ACTIVATION_EVENTS.forEach((e) => window.addEventListener(e, onActivation, opts));
    return () => {
      ACTIVATION_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivation, opts),
      );
    };
  }, []);

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
  }, [off, resumeAudible]);

  // Admin sub-pages: pause. Leaving them: restart music + finger.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (adminSubPage || overlayPauseRef.current) {
      audio.pause();
      return;
    }
    if (window.localStorage.getItem(OFF_KEY) === "1") {
      setOff(true);
      return;
    }
    setOff(false);
    void startMusicWithFinger(audio);
  }, [adminSubPage, startMusicWithFinger]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !off;
    setOff(next);
    window.localStorage.setItem(OFF_KEY, next ? "1" : "0");
    if (next) {
      dismissHint();
      audio.pause();
    } else {
      // Turning music back on → finger + play together again
      void startMusicWithFinger(audio);
    }
  };

  const onAdminLanding = ADMIN_MUSIC_LANDING.has(pathname);
  const onPublicHome = pathname === "/";

  // Hide finger on admin sub-pages where the control is hidden
  const fingerVisible = showHint && !adminSubPage;

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
                  {off ? "Tap to play music" : "Music on — tap to mute"}
                </span>
                <span className="hidden sm:inline">
                  {off
                    ? "Click the speaker to play music."
                    : "Music is on — click to mute anytime."}
                </span>
              </p>
              {/* Real emoji 👉 medium-dark tan, points right */}
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
            className="bg-music-toggle relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985]"
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
