"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BG_MUSIC_OVERLAY_EVENT,
  BG_MUSIC_REQUEST_PLAY_EVENT,
  clearBackgroundMusicHolds,
  getBackgroundMusicUnlockCount,
  isBackgroundMusicUserMuted,
  markBackgroundMusicElement,
  persistBackgroundMusicMute,
  persistBackgroundMusicUnlockCount,
  persistBackgroundMusicPlayed,
  registerBackgroundMusicMediaDucking,
} from "@/lib/background-music-control";
import {
  applyMixVolume,
  canStartThemeSongFromSilence,
  clampMixVolume,
  clampThemeSongClickStarts,
  THEME_SONG_CLICK_STARTS_DEFAULT,
  THEME_SONG_DEFAULT_VOLUME,
  THEME_SONG_SRC,
  unlockLandingMix,
} from "@/lib/landing-mix-audio";
import { allowThemeSong, isGuestThemeSongPath } from "@/lib/theme-song";

/**
 * Guest-only Theme Song + pointing-finger mute guide.
 *
 * Plays on landing / explore / join / signup. The corner speaker is the
 * mute for that song. Off on /login so it cannot cover the PIN pad.
 * Once a login exists, Theme Song is not part of the app —
 * no speaker on workout, member, or admin.
 */

const SRC = THEME_SONG_SRC;
/** Finger stays up at least this long (mute also dismisses). */
const HINT_MS = 22_000;

// pointerdown covers mouse + touch once (do not also listen to click/touchstart —
// that would burn both gesture unlocks on a single tap).
const ACTIVATION_EVENTS: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];

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
  /** When false: no Theme Song (logged-in app, admin, non-guest paths). */
  const autoPlayAllowedRef = useRef(false);
  const signedInRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  /**
   * Session mute from the corner speaker (sessionStorage).
   * Once muted, Theme Song does not start again this tab — not even from the speaker.
   */
  const speakerMutedRef = useRef(false);
  /** Ignore activation that is the same click as the speaker mute (capture fires first). */
  const ignoreNextActivationRef = useRef(false);
  /** How many times the song has started from silence this tab. */
  const gestureUnlockCountRef = useRef(0);
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [mix, setMix] = useState({
    enabled: true,
    volume: THEME_SONG_DEFAULT_VOLUME,
    clickStarts: THEME_SONG_CLICK_STARTS_DEFAULT,
  });
  const mixRef = useRef(mix);
  mixRef.current = mix;

  const autoPlayAllowed = allowThemeSong(pathname, signedIn) && mix.enabled;

  useEffect(() => {
    adminRouteRef.current = onAdmin;
  }, [onAdmin]);

  useEffect(() => {
    autoPlayAllowedRef.current = autoPlayAllowed;
  }, [autoPlayAllowed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) applyMixVolume(audio, mix.volume);
  }, [mix.volume]);

  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);

  // Resolve session so logged-in landing home can silence autoplay
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) {
          if (!cancelled) {
            setSignedIn(false);
            setAuthReady(true);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setSignedIn(Boolean(data.signedIn && data.user));
        setAuthReady(true);
      } catch {
        if (!cancelled) {
          setSignedIn(false);
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  /** Speaker shows muted (session only). */
  const [off, setOff] = useState(false);
  /**
   * True only when we confirm real audible playback (currentTime advancing, unmuted).
   * Starts false so the icon is muted until sound actually works.
   */
  const [soundLive, setSoundLive] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Restore mute / start-count for this tab (signup full-page loads used to restart the song)
  useEffect(() => {
    const muted = isBackgroundMusicUserMuted();
    speakerMutedRef.current = muted;
    gestureUnlockCountRef.current = getBackgroundMusicUnlockCount();
    setOff(muted);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/landing-media", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          themeSongEnabled?: boolean;
          themeSongVolume?: unknown;
          themeSongClickStarts?: unknown;
        };
        if (cancelled) return;
        const next = {
          enabled: data.themeSongEnabled !== false,
          volume: clampMixVolume(data.themeSongVolume, THEME_SONG_DEFAULT_VOLUME),
          clickStarts: clampThemeSongClickStarts(
            data.themeSongClickStarts,
            THEME_SONG_CLICK_STARTS_DEFAULT,
          ),
        };
        mixRef.current = next;
        setMix(next);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
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
    if (advancing) {
      unlockedRef.current = true;
      persistBackgroundMusicPlayed();
      if (gestureUnlockCountRef.current < 1) {
        gestureUnlockCountRef.current = 1;
        persistBackgroundMusicUnlockCount(1);
      }
    }
    return advancing;
  }, []);

  const stopMusicQuiet = useCallback((audio: HTMLAudioElement) => {
    audio.pause();
    audio.muted = true;
    setSoundLive(false);
    unlockedRef.current = false;
    dismissHint();
  }, [dismissHint]);

  const stopAdminMusic = useCallback(
    (audio: HTMLAudioElement) => {
      stopMusicQuiet(audio);
    },
    [stopMusicQuiet],
  );

  const forceAudible = useCallback(
    async (
      audio: HTMLAudioElement,
      opts?: { fromSpeakerMute?: boolean; fromSpeakerButton?: boolean },
    ) => {
      if (adminRouteRef.current || !autoPlayAllowedRef.current) {
        stopAdminMusic(audio);
        return false;
      }
      // Mute is sticky for the tab — speaker included
      if (speakerMutedRef.current) {
        setSoundLive(false);
        setOff(true);
        return false;
      }
      if (opts?.fromSpeakerMute) {
        setSoundLive(false);
        return false;
      }
      overlayPauseRef.current = false;
      clearBackgroundMusicHolds();

      if (audio.paused || audio.ended) {
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      applyMixVolume(audio, mixRef.current.volume);
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
      if (adminRouteRef.current || !autoPlayAllowedRef.current) {
        stopMusicQuiet(audio);
        return;
      }
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        ) &&
        (audio.paused || audio.muted)
      ) {
        return;
      }
      // User muted via speaker — stay quiet
      if (speakerMutedRef.current) {
        audio.muted = true;
        audio.pause();
        setSoundLive(false);
        setOff(true);
        return;
      }
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        )
      ) {
        if (!audio.paused && !audio.muted) {
          setSoundLive(true);
          setOff(false);
        }
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

      audio.loop = false;
      audio.preload = "auto";
      audio.defaultMuted = false;
      audio.setAttribute("playsinline", "true");
      try {
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      } catch {
        /* ignore */
      }
      applyMixVolume(audio, mixRef.current.volume);

      await whenCanPlay(audio);
      if (adminRouteRef.current || !autoPlayAllowedRef.current) {
        stopMusicQuiet(audio);
        return;
      }
      // Gesture may have unlocked during load wait — never remute after that
      if (unlockedRef.current || speakerMutedRef.current) return;
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        )
      ) {
        return;
      }

      // Try audible autoplay a few times
      for (let i = 0; i < 5; i++) {
        if (adminRouteRef.current || !autoPlayAllowedRef.current) {
          stopMusicQuiet(audio);
          return;
        }
        if (unlockedRef.current || speakerMutedRef.current) {
          return;
        }
        if (
          !canStartThemeSongFromSilence(
            gestureUnlockCountRef.current,
            mixRef.current.clickStarts,
          )
        ) {
          return;
        }
        audio.muted = false;
        applyMixVolume(audio, mixRef.current.volume);
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
      if (!autoPlayAllowedRef.current) {
        stopMusicQuiet(audio);
        return;
      }

      // Buffer muted — icon stays muted; gesture unlock (up to budget) can start song
      audio.muted = true;
      try {
        await audio.play();
      } catch {
        /* cold start on gesture */
      }
      setSoundLive(false);
    },
    [showFingerForAtLeastTwentySeconds, confirmSoundLive, stopMusicQuiet],
  );

  useEffect(() => registerBackgroundMusicMediaDucking(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    markBackgroundMusicElement(audio);
    audio.loop = false;
    const onEnded = () => {
      persistBackgroundMusicUnlockCount(gestureUnlockCountRef.current);
      persistBackgroundMusicPlayed();
      setSoundLive(false);
      unlockedRef.current = false;
    };
    audio.addEventListener("ended", onEnded);

    // Wait for auth on "/" so we don't start song then kill it for signed-in members
    if (!authReady && (pathname === "/" || pathname === "/landing")) {
      return;
    }

    if (adminRouteRef.current || !autoPlayAllowedRef.current) {
      stopMusicQuiet(audio);
    } else {
      void startMusicWithFinger(audio);
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (adminRouteRef.current || !autoPlayAllowedRef.current) {
        stopMusicQuiet(audio);
        return;
      }
      if (overlayPauseRef.current) return;
      // Never un-mute or re-unlock just because the tab came back
      if (speakerMutedRef.current) return;
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        ) &&
        (audio.paused || audio.muted)
      ) {
        return;
      }
      // Only resume if already unlocked and was playing path
      if (unlockedRef.current && !audio.muted) {
        void forceAudible(audio);
      }
    };
    const onPageShow = () => {
      if (adminRouteRef.current || !autoPlayAllowedRef.current) {
        stopMusicQuiet(audio);
        return;
      }
      if (speakerMutedRef.current) return;
      void startMusicWithFinger(audio);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      audio.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      clearHintTimer();
    };
  }, [
    startMusicWithFinger,
    forceAudible,
    clearHintTimer,
    stopMusicQuiet,
    authReady,
    pathname,
    autoPlayAllowed,
  ]);

  // Guest funnel: one “tap anywhere” starts Theme Song. After login: nothing.
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
      const path = window.location.pathname || "";
      if (
        isGuestThemeSongPath(path) &&
        !signedInRef.current &&
        !adminRouteRef.current
      ) {
        unlockLandingMix();
      }
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current) {
        if (audio && adminRouteRef.current) stopAdminMusic(audio);
        return;
      }
      if (!autoPlayAllowedRef.current) {
        return;
      }
      // Explicit mute: do not treat page taps as unlock
      if (speakerMutedRef.current) {
        return;
      }
      // Already playing unmuted — don't burn an unlock or re-fire
      if (!audio.paused && !audio.muted) {
        return;
      }
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        )
      ) {
        return;
      }
      gestureUnlockCountRef.current += 1;
      persistBackgroundMusicUnlockCount(gestureUnlockCountRef.current);
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
      if (!autoPlayAllowedRef.current) return;
      // Don't force theme song back after free-ticket / intro video unless already unlocked
      if (!unlockedRef.current) return;
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        ) &&
        (audio.paused || audio.muted)
      ) {
        return;
      }
      void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
    return () => window.removeEventListener(BG_MUSIC_OVERLAY_EVENT, onOverlay);
  }, [forceAudible]);

  useEffect(() => {
    const onRequestPlay = () => {
      const audio = audioRef.current;
      if (!audio || adminRouteRef.current) return;
      // FreeTicketModal / intro close may request play — only on funnel routes
      if (!autoPlayAllowedRef.current) return;
      // Never override speaker mute or restart after gesture budget
      if (speakerMutedRef.current) return;
      if (!unlockedRef.current) return;
      if (
        !canStartThemeSongFromSilence(
          gestureUnlockCountRef.current,
          mixRef.current.clickStarts,
        ) &&
        (audio.paused || audio.muted)
      ) {
        return;
      }
      void forceAudible(audio);
    };
    window.addEventListener(BG_MUSIC_REQUEST_PLAY_EVENT, onRequestPlay);
    return () => window.removeEventListener(BG_MUSIC_REQUEST_PLAY_EVENT, onRequestPlay);
  }, [forceAudible]);

  // Route / auth change: stop on admin + registered member app; funnel may start.
  // Preserve speaker mute across navigations (user already chose quiet).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!authReady && (pathname === "/" || pathname === "/landing")) {
      return;
    }
    if (onAdmin || !autoPlayAllowed || overlayPauseRef.current) {
      stopMusicQuiet(audio);
      return;
    }
    if (speakerMutedRef.current || isBackgroundMusicUserMuted()) {
      audio.muted = true;
      audio.pause();
      setSoundLive(false);
      setOff(true);
      return;
    }
    if (gestureUnlockCountRef.current > 0) {
      return;
    }
    void startMusicWithFinger(audio);
  }, [onAdmin, autoPlayAllowed, authReady, pathname, startMusicWithFinger, stopMusicQuiet]);

  /** Single mute control. After mute, Theme Song stays off for this tab. */
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextActivationRef.current = true;
    const audio = audioRef.current;
    if (!audio || adminRouteRef.current || !autoPlayAllowedRef.current) return;

    speakerMutedRef.current = true;
    persistBackgroundMusicMute(true);
    persistBackgroundMusicPlayed();
    gestureUnlockCountRef.current = mixRef.current.clickStarts;
    persistBackgroundMusicUnlockCount(gestureUnlockCountRef.current);
    setOff(true);
    setSoundLive(false);
    unlockedRef.current = false;
    dismissHint();
    audio.muted = true;
    audio.pause();
  };

  const onPublicHome = pathname === "/" && !signedIn;
  // Finger only while Theme Song is actually in play for guests (not the public home mute chip).
  const fingerVisible = showHint && autoPlayAllowed && !onPublicHome;

  // Honest icon: only “on” when sound is confirmed live
  const showAsPlaying = !off && soundLive;

  const remainingStarts = Math.max(
    0,
    mix.clickStarts - gestureUnlockCountRef.current,
  );
  const gestureBudgetLeft = autoPlayAllowed && remainingStarts > 0;
  const againLabel =
    mix.clickStarts > 1 && remainingStarts > 0 && remainingStarts < mix.clickStarts
      ? `tap to play again (${remainingStarts} left)`
      : remainingStarts > 0
        ? "tap anywhere to play"
        : mix.clickStarts === 1
          ? "one play"
          : `${mix.clickStarts} plays used`;
  const bubbleMobile = off
    ? "Theme Song muted"
    : soundLive
      ? "Theme Song — tap to mute"
      : `Theme Song — ${againLabel}`;
  const bubbleDesktop = off
    ? "Theme Song muted"
    : soundLive
      ? "Theme Song — click to mute"
      : `Theme Song — ${againLabel.replace("tap", "click")}`;

  // Guest explore / create-login only. Workout and every logged-in surface: no speaker.
  const showSpeaker =
    autoPlayAllowed && (authReady || (pathname !== "/" && pathname !== "/landing"));

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        // Never HTML autoplay on admin or logged-in member app
        autoPlay={false}
        preload={onAdmin || !autoPlayAllowed ? "none" : "auto"}
        muted={onAdmin || !autoPlayAllowed}
        playsInline
        data-ts-bg-music="true"
      />
      {showSpeaker ? (
        <div
          className="bg-music-control-cluster fixed z-[120] flex items-end overflow-visible"
          style={{
            right: "max(0.75rem, env(safe-area-inset-right, 0px))",
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
