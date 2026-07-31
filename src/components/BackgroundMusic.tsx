"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BG_MUSIC_OVERLAY_EVENT,
  BG_MUSIC_REQUEST_PLAY_EVENT,
  clearBackgroundMusicHolds,
  clearPersistedBackgroundMusicMute,
  markBackgroundMusicElement,
  registerBackgroundMusicMediaDucking,
} from "@/lib/background-music-control";

/**
 * Site-wide background music + pointing-finger guide.
 *
 * Any tap on the landing (and other public pages) starts Theme Song.
 * Mute is session-only via the corner speaker — never localStorage.
 * (Persisted mute blocked private windows / return visits.)
 */

const SRC = "/background-music.mp3";
const VOLUME = 0.55;
/** Finger stays up at least this long (mute also dismisses). */
const HINT_MS = 22_000;
/** “Tap anywhere” unlocks Theme Song at most this many times; then only the speaker. */
const MAX_GESTURE_UNLOCKS = 2;

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
  /**
   * Session-only mute from the corner speaker (not persisted).
   * First two non-speaker taps can still clear this and start Theme Song.
   */
  const speakerMutedRef = useRef(false);
  /** Ignore activation that is the same click as the speaker mute (capture fires first). */
  const ignoreNextActivationRef = useRef(false);
  /** How many times “tap anywhere” has started/unmuted the song this session. */
  const gestureUnlockCountRef = useRef(0);

  useEffect(() => {
    adminRouteRef.current = onAdmin;
  }, [onAdmin]);

  /** Speaker shows muted (session only). */
  const [off, setOff] = useState(false);
  /**
   * True only when we confirm real audible playback (currentTime advancing, unmuted).
   * Starts false so the icon is muted until sound actually works.
   */
  const [soundLive, setSoundLive] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Never inherit mute from a previous visit; reset gesture budget each load
  useEffect(() => {
    clearPersistedBackgroundMusicMute();
    speakerMutedRef.current = false;
    gestureUnlockCountRef.current = 0;
    setOff(false);
  }, []);

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
    async (audio: HTMLAudioElement, opts?: { fromSpeakerMute?: boolean }) => {
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return false;
      }
      // Tap anywhere always starts song — clear session speaker mute
      // (unless this call is the mute side of the speaker toggle)
      if (!opts?.fromSpeakerMute) {
        speakerMutedRef.current = false;
        setOff(false);
      } else if (speakerMutedRef.current) {
        setSoundLive(false);
        return false;
      }

      overlayPauseRef.current = false;
      clearBackgroundMusicHolds();
      clearPersistedBackgroundMusicMute();

      audio.volume = VOLUME;
      audio.muted = false;
      try {
        await audio.play();
      } catch {
        setSoundLive(false);
        return false;
      }
      // Speaker was muted mid-flight
      if (speakerMutedRef.current) {
        audio.muted = true;
        audio.pause();
        setSoundLive(false);
        setOff(true);
        return false;
      }
      unlockedRef.current = true;
      setOff(false);
      const ok = await confirmSoundLive(audio);
      if (speakerMutedRef.current) {
        audio.muted = true;
        audio.pause();
        setSoundLive(false);
        setOff(true);
        unlockedRef.current = false;
        return false;
      }
      if (!ok) {
        setSoundLive(!audio.paused && !audio.muted);
      }
      return !audio.paused && !audio.muted;
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

      // Don't restart bootstrap if a tap already unlocked
      if (unlockedRef.current && !audio.paused && !audio.muted) {
        setSoundLive(true);
        setOff(false);
        return;
      }

      setOff(false);
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
      // Gesture may have unlocked during load wait — never remute after that
      if (unlockedRef.current || speakerMutedRef.current) return;

      // Try audible autoplay a few times
      for (let i = 0; i < 5; i++) {
        if (adminRouteRef.current || unlockedRef.current || speakerMutedRef.current) {
          if (adminRouteRef.current) stopAdminMusic(audio);
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
        if (unlockedRef.current || speakerMutedRef.current) return;
        await sleep(180 * (i + 1));
      }

      if (unlockedRef.current || speakerMutedRef.current) return;

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
      if (overlayPauseRef.current) return;
      void forceAudible(audio);
    };
    const onPageShow = () => {
      if (adminRouteRef.current) {
        stopAdminMusic(audio);
        return;
      }
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

  // First two real gestures (landing tap, Free Quick Tour, etc.) start Theme Song.
  // After that, only the corner speaker can play/mute — third+ page click is quiet.
  useEffect(() => {
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const onActivation = (e: Event) => {
      if (ignoreNextActivationRef.current) {
        ignoreNextActivationRef.current = false;
        return;
      }
      const t = e.target;
      if (
        t instanceof Element &&
        t.closest(".bg-music-control-cluster, .bg-music-toggle")
      ) {
        return;
      }
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current) {
        if (audio && adminRouteRef.current) stopAdminMusic(audio);
        return;
      }
      // Already playing unmuted — don't burn an unlock or re-fire
      if (!audio.paused && !audio.muted && !speakerMutedRef.current) {
        return;
      }
      if (gestureUnlockCountRef.current >= MAX_GESTURE_UNLOCKS) {
        return;
      }
      gestureUnlockCountRef.current += 1;
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
      // Don't auto-resume after video duck if user just muted via speaker
      if (speakerMutedRef.current) return;
      void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
  }, [forceAudible]);

  useEffect(() => {
    const onRequestPlay = () => {
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current) return;
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
    // Fresh page: never carry mute
    speakerMutedRef.current = false;
    setOff(false);
    void startMusicWithFinger(audio);
  }, [onAdmin, startMusicWithFinger, stopAdminMusic]);

  /** Single mute control: corner speaker only. Session-only (not remembered). */
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextActivationRef.current = true;
    const audio = audioRef.current;
    if (!audio || adminRouteRef.current) return;

    // Currently playing → mute for this session only
    if (!off && (soundLive || !audio.paused)) {
      speakerMutedRef.current = true;
      setOff(true);
      setSoundLive(false);
      unlockedRef.current = false;
      dismissHint();
      clearPersistedBackgroundMusicMute();
      audio.muted = true;
      audio.pause();
      return;
    }

    // Muted / waiting → play (this click is the gesture)
    speakerMutedRef.current = false;
    setOff(false);
    clearPersistedBackgroundMusicMute();
    void forceAudible(audio);
  };

  const onPublicHome = pathname === "/";
  // Cold home: never cover the primary CTA with Theme Song + finger.
  // Quiet speaker only; music still unlocks on any gesture.
  const fingerVisible = showHint && !onAdmin && !onPublicHome;

  // Honest icon: only “on” when sound is confirmed live
  const showAsPlaying = !off && soundLive;

  const gestureBudgetLeft = gestureUnlockCountRef.current < MAX_GESTURE_UNLOCKS;
  const bubbleMobile = off
    ? gestureBudgetLeft
      ? "Theme Song — tap to play"
      : "Theme Song — tap speaker to play"
    : soundLive
      ? "Theme Song — tap to mute"
      : gestureBudgetLeft
        ? "Theme Song — tap anywhere to play"
        : "Theme Song — tap speaker to play";
  const bubbleDesktop = off
    ? gestureBudgetLeft
      ? "Theme Song — click the speaker to play"
      : "Theme Song — click speaker to play"
    : soundLive
      ? "Theme Song — click to mute anytime"
      : gestureBudgetLeft
        ? "Theme Song — click anywhere to play"
        : "Theme Song — click speaker to play";

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
            onPointerDown={(e) => e.stopPropagation()}
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
