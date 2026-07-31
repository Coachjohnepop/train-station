"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BG_MUSIC_OVERLAY_EVENT,
  BG_MUSIC_REQUEST_PLAY_EVENT,
  markBackgroundMusicElement,
  registerBackgroundMusicMediaDucking,
} from "@/lib/background-music-control";

/**
 * Site-wide background music + pointing-finger guide.
 *
 * Speaker icon is honest: it only shows “playing” after we confirm the track
 * is unmuted AND currentTime is advancing. Until then it shows muted and the
 * finger says “tap for sound” — even in a brand-new private window (browsers
 * almost always block silent-tab autoplay with volume).
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.55;
const OFF_KEY = "ts-bg-music-muted";
/** Finger stays up at least this long (mute also dismisses). */
const HINT_MS = 22_000;

const ACTIVATION_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "touchstart",
  "click",
];

/** No theme song on any coach/platform admin surface (including /admin/day). */
function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isUserMuted(): boolean {
  try {
    return window.localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

export default function BackgroundMusic() {
  const pathname = usePathname() ?? "";
  const onAdmin = isAdminRoute(pathname);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overlayPauseRef = useRef(false);
  /** Keep handlers (gestures / visibility) from restarting music on admin. */
  const adminRouteRef = useRef(onAdmin);
  const hintTimerRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    adminRouteRef.current = onAdmin;
  }, [onAdmin]);

  /** User hit mute on the speaker. */
  const [off, setOff] = useState(false);
  /**
   * True until we confirm real audible playback (currentTime advancing, unmuted).
   * Starts true so the icon is muted in private windows until sound works.
   */
  const [soundLive, setSoundLive] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

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

  /** Confirm the engine is actually moving the playhead with sound on. */
  const confirmSoundLive = useCallback(async (audio: HTMLAudioElement) => {
    if (audio.paused || audio.muted) {
      setSoundLive(false);
      return false;
    }
    const t0 = audio.currentTime;
    await sleep(280);
    const advancing =
      !audio.paused &&
      !audio.muted &&
      (audio.currentTime > t0 + 0.05 || audio.currentTime > 0.15);
    setSoundLive(advancing);
    if (advancing) unlockedRef.current = true;
    return advancing;
  }, []);

  const stopAdminMusic = useCallback((audio: HTMLAudioElement) => {
    audio.pause();
    audio.muted = true;
    setSoundLive(false);
    dismissHint();
  }, [dismissHint]);

  const forceAudible = useCallback(
    async (audio: HTMLAudioElement) => {
      if (adminRouteRef.current || isUserMuted() || overlayPauseRef.current) {
        if (adminRouteRef.current) stopAdminMusic(audio);
        else setSoundLive(false);
        return false;
      }
      audio.volume = VOLUME;
      audio.muted = false;
      try {
        await audio.play();
      } catch {
        setSoundLive(false);
        return false;
      }
      const ok = await confirmSoundLive(audio);
      if (ok) setOff(false);
      return ok;
    },
    [confirmSoundLive, stopAdminMusic],
  );

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
        audio.load();
      } catch {
        /* ignore */
      }
      window.setTimeout(finish, ms);
    });

  /** Finger + best-effort music. Speaker stays “muted” until sound is confirmed. */
  const startMusicWithFinger = useCallback(
    async (audio: HTMLAudioElement) => {
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return;
      }

      showFingerForAtLeastTwentySeconds();

      if (isUserMuted()) {
        setOff(true);
        setSoundLive(false);
        return;
      }

      setOff(false);
      // Optimistic: not live until confirmSoundLive says so
      setSoundLive(false);

      audio.loop = true;
      audio.preload = "auto";
      audio.defaultMuted = false;
      audio.setAttribute("playsinline", "true");
      try {
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      } catch {
        /* ignore */
      }
      audio.volume = VOLUME;

      await whenCanPlay(audio);
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return;
      }

      // Try audible autoplay a few times
      for (let i = 0; i < 5; i++) {
        if (adminRouteRef.current) {
          stopAdminMusic(audio);
          return;
        }
        audio.muted = false;
        audio.volume = VOLUME;
        try {
          await audio.play();
          if (await confirmSoundLive(audio)) return;
        } catch {
          /* blocked */
        }
        await sleep(180 * (i + 1));
      }

      // Buffer muted — icon stays muted; any gesture will unlock
      audio.muted = true;
      try {
        await audio.play();
      } catch {
        /* cold start on gesture */
      }
      setSoundLive(false);
    },
    [showFingerForAtLeastTwentySeconds, confirmSoundLive, stopAdminMusic],
  );

  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);

    if (adminRouteRef.current) {
      stopAdminMusic(audio);
    } else {
      void startMusicWithFinger(audio);
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return;
      }
      if (isUserMuted() || overlayPauseRef.current) return;
      void forceAudible(audio);
    };
    const onPageShow = () => {
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return;
      }
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
  }, [startMusicWithFinger, forceAudible, clearHintTimer, stopAdminMusic]);

  // First real gesture → unlock sound (does not hide the finger)
  useEffect(() => {
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const onActivation = () => {
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current || isUserMuted() || overlayPauseRef.current) {
        if (audio && adminRouteRef.current) stopAdminMusic(audio);
        return;
      }
      void forceAudible(audio);
    };
    ACTIVATION_EVENTS.forEach((e) => window.addEventListener(e, onActivation, opts));
    return () => {
      ACTIVATION_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivation, opts),
      );
    };
  }, [forceAudible, stopAdminMusic]);

  useEffect(() => {
    const onOverlay = (e: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active);
      overlayPauseRef.current = active;
      if (active || adminRouteRef.current) {
        audio.pause();
        setSoundLive(false);
        return;
      }
      if (!isUserMuted()) void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
  }, [forceAudible]);

  // Free Quick Tour / Watch intro open: same user gesture → unlock theme song.
  useEffect(() => {
    const onRequestPlay = () => {
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current || isUserMuted()) return;
      overlayPauseRef.current = false;
      void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_REQUEST_PLAY_EVENT, onRequestPlay);
    return () => window.removeEventListener(BG_MUSIC_REQUEST_PLAY_EVENT, onRequestPlay);
  }, [forceAudible]);

  // Route change: hard-stop on any /admin path; resume only on member/public.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (onAdmin || overlayPauseRef.current) {
      stopAdminMusic(audio);
      return;
    }
    if (isUserMuted()) {
      setOff(true);
      setSoundLive(false);
      return;
    }
    void startMusicWithFinger(audio);
  }, [onAdmin, startMusicWithFinger, stopAdminMusic]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || adminRouteRef.current) return;

    // If we're only waiting for a gesture, speaker click = unlock (user gesture)
    if (!off && !soundLive) {
      void forceAudible(audio).then((ok) => {
        if (!ok) {
          // Still blocked — fall through to treat as explicit play attempt
          audio.muted = false;
          void audio.play().then(() => confirmSoundLive(audio));
        }
      });
      return;
    }

    const next = !off;
    setOff(next);
    try {
      window.localStorage.setItem(OFF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next) {
      dismissHint();
      setSoundLive(false);
      unlockedRef.current = false;
      audio.muted = true;
      audio.pause();
    } else {
      // Explicit unmute is a user gesture — should allow sound
      void startMusicWithFinger(audio).then(() => forceAudible(audio));
    }
  };

  const onPublicHome = pathname === "/";
  // Cold home: never cover the primary CTA with Theme Song + finger.
  // Quiet speaker only; music still unlocks on any gesture.
  const fingerVisible = showHint && !onAdmin && !onPublicHome;

  // Honest icon: only “on” when sound is confirmed live
  const showAsPlaying = !off && soundLive;

  const bubbleMobile = off
    ? "Theme Song — tap to play"
    : soundLive
      ? "Theme Song — tap to mute"
      : "Theme Song — tap anywhere to play";
  const bubbleDesktop = off
    ? "Theme Song — click the speaker to play"
    : soundLive
      ? "Theme Song — click to mute anytime"
      : "Theme Song — click anywhere to play";

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        loop
        // Never autoplay on admin — route effect + muted start; public may unlock later
        autoPlay={!onAdmin}
        preload={onAdmin ? "none" : "auto"}
        muted={onAdmin}
        playsInline
        data-ts-bg-music="true"
      />
      {!onAdmin ? (
        <div
          className={`bg-music-control-cluster fixed z-[120] flex items-end overflow-visible ${
            onPublicHome ? "bottom-4 sm:bottom-7" : "bottom-6"
          }`}
          style={{
            right: "max(0.75rem, env(safe-area-inset-right, 0px))",
            bottom: onPublicHome
              ? undefined
              : "max(1.25rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          {fingerVisible ? (
            <div className="bg-music-guide" role="status" aria-live="polite">
              <p className="bg-music-guide-bubble">
                <span className="sm:hidden">{bubbleMobile}</span>
                <span className="hidden sm:inline">{bubbleDesktop}</span>
              </p>
              <span className="bg-music-guide-pointer" aria-hidden>
                {"\u{1F449}\u{1F3FD}"}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            aria-label={showAsPlaying ? "Mute background music" : "Play background music"}
            title={showAsPlaying ? "Mute music" : "Play music"}
            className={`bg-music-toggle relative z-10 inline-flex shrink-0 items-center justify-center rounded-2xl border shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.985] ${
              onPublicHome ? "h-10 w-10 opacity-80" : "h-11 w-11"
            } ${
              showAsPlaying
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg))] text-[var(--text)]"
                : "border-white/25 bg-black/45 text-white/80"
            }`}
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
