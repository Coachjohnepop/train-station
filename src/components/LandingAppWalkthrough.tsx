"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  APP_WALK_COPY,
  APP_WALK_EXERCISES,
  JEREMY_WALK_INTRO_SRC,
  type AppWalkPhase,
} from "@/lib/landing-app-walk";
import { MIX_AUDIO_ATTR } from "@/lib/landing-mix-audio";
import {
  JOIN_TICKETS_HREF,
  fireLandingJoinHook,
  markLandingConverted,
  trackLandingCustom,
} from "@/lib/landing-return-visit";

const START_STYLE_HREF = "/signup?plan=explorer";

let walkVoice: HTMLAudioElement | null = null;

function playJeremyIntro(): void {
  if (typeof window === "undefined") return;
  if (!walkVoice) {
    walkVoice = new Audio(JEREMY_WALK_INTRO_SRC);
    walkVoice.preload = "auto";
    walkVoice.setAttribute(MIX_AUDIO_ATTR, "true");
    walkVoice.setAttribute("playsinline", "true");
  }
  walkVoice.currentTime = 0;
  void walkVoice.play().catch(() => {
    /* autoplay blocked until tap — ask buttons are the gesture */
  });
}

function stopJeremyIntro(): void {
  if (!walkVoice) return;
  walkVoice.pause();
  walkVoice.currentTime = 0;
}

export default function LandingAppWalkthrough({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<AppWalkPhase>("ask");
  const [restLeft, setRestLeft] = useState(45);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      stopJeremyIntro();
      setPhase("ask");
      setRestLeft(45);
      if (restRef.current) window.clearInterval(restRef.current);
      return;
    }
    document.documentElement.dataset.landingTour = "open";
    return () => {
      delete document.documentElement.dataset.landingTour;
    };
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "rest") {
      if (restRef.current) window.clearInterval(restRef.current);
      return;
    }
    setRestLeft(45);
    restRef.current = window.setInterval(() => {
      setRestLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => {
      if (restRef.current) window.clearInterval(restRef.current);
    };
  }, [open, phase]);

  const go = useCallback((next: AppWalkPhase) => {
    setPhase(next);
    trackLandingCustom(`walk-${next}`);
    if (next === "today") playJeremyIntro();
  }, []);

  const exitTo = useCallback(
    (href: string) => {
      stopJeremyIntro();
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  if (!open || !mounted) return null;

  const copy = phase === "ask" ? null : APP_WALK_COPY[phase];

  return createPortal(
    <div
      className="landing-app-walk force-dark fixed inset-0 z-[100] flex flex-col bg-[#07040f]"
      data-force-dark
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-walk-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
            Using the app
          </p>
          <h2 id="app-walk-title" className="text-base font-semibold text-white sm:text-lg">
            {phase === "ask" ? "Quick question" : copy?.title}
          </h2>
        </div>
        <button
          type="button"
          data-analytics-action="walk-close"
          onClick={() => {
            stopJeremyIntro();
            onClose();
          }}
          className="min-h-11 rounded-full border border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/90"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {phase === "ask" ? (
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-6">
            <p className="text-center text-xl font-semibold leading-snug text-white sm:text-2xl">
              Would you use the Train Station if you could bring your own workout?
            </p>
            <p className="text-center text-sm text-white/70">
              Paste isn&apos;t open yet. Tell us, then we&apos;ll show the real Today screen — not a cartoon.
            </p>
            <button
              type="button"
              data-analytics-action="hero-b-byow-interest-yes"
              onClick={() => go("today")}
              className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
            >
              Yes — I&apos;d use it
            </button>
            <button
              type="button"
              data-analytics-action="hero-b-byow-interest-no"
              onClick={() => go("today")}
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 text-[15px] font-bold text-white/90"
            >
              Not sure yet
            </button>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-2 max-w-md text-center text-sm font-medium text-[#e9d5ff]">
              {copy?.line}
            </p>
            {phase !== "done" ? (
              <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                Jeremy&apos;s intro playing · his real voice from the videos
              </p>
            ) : null}

            <div className="mx-auto mt-4 w-full max-w-[22rem] overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#12081f] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Today</p>
                <p className="text-xs font-semibold text-white/80">Adult · Lower body</p>
              </div>

              {phase === "today" ? (
                <ul className="divide-y divide-white/10">
                  {APP_WALK_EXERCISES.map((ex, i) => (
                    <li key={ex.name} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{ex.name}</p>
                        <p className="text-xs text-white/55">{ex.rx}</p>
                      </div>
                      {i === 0 ? (
                        <span className="rounded-full bg-[#7c3aed]/80 px-2 py-0.5 text-[10px] font-bold text-white">
                          Next
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/35">queued</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}

              {phase === "set" ? (
                <div className="space-y-3 px-4 py-5">
                  <p className="text-lg font-bold text-white">Air Squats</p>
                  <p className="text-sm text-white/60">Set 1 of 3 · 3 × 10</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-semibold tabular-nums text-white">135</span>
                    <span className="pb-1 text-sm text-white/50">lb</span>
                  </div>
                  <button
                    type="button"
                    data-analytics-action="walk-log-set"
                    onClick={() => go("rest")}
                    className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7c3aed] text-sm font-extrabold text-white"
                  >
                    Log set
                  </button>
                </div>
              ) : null}

              {phase === "rest" ? (
                <div className="space-y-3 px-4 py-8 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Rest</p>
                  <p className="text-5xl font-semibold tabular-nums text-white">
                    0:{String(restLeft).padStart(2, "0")}
                  </p>
                  <p className="text-sm text-white/60">Timer started when you logged the set.</p>
                </div>
              ) : null}

              {phase === "done" ? (
                <div className="space-y-3 px-4 py-6 text-center">
                  <p className="text-sm text-white/75">
                    Same checkoffs, rest, and confetti you just saw. Jeremy&apos;s board is ready now.
                    Paste-your-own comes later.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mx-auto mt-5 flex w-full max-w-md flex-col gap-2">
              {phase === "today" ? (
                <button
                  type="button"
                  data-analytics-action="walk-next-today"
                  onClick={() => go("set")}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-extrabold text-white"
                >
                  Open the first exercise
                </button>
              ) : null}
              {phase === "rest" ? (
                <button
                  type="button"
                  data-analytics-action="walk-next-rest"
                  onClick={() => go("done")}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-extrabold text-white"
                >
                  Next
                </button>
              ) : null}
              {phase === "done" ? (
                <>
                  <button
                    type="button"
                    data-analytics-action="hero-b-train-station-style"
                    onClick={(e) => {
                      markLandingConverted();
                      fireLandingJoinHook(e.currentTarget);
                      exitTo(START_STYLE_HREF);
                    }}
                    className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] text-[17px] font-extrabold text-white"
                  >
                    Train Station Style
                  </button>
                  <button
                    type="button"
                    data-analytics-action="walk-membership"
                    onClick={(e) => {
                      markLandingConverted();
                      fireLandingJoinHook(e.currentTarget);
                      exitTo(JOIN_TICKETS_HREF);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 text-sm font-bold text-white/85"
                  >
                    Start membership
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
