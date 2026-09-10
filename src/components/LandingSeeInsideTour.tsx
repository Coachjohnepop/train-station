"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";
import FreeTicketModal from "@/components/FreeTicketModal";
import HowItWorksScreen from "@/components/HowItWorksScreen";
import HowItWorksVoice from "@/components/HowItWorksVoice";
import {
  FREE_TICKET_GAG_HOST_ID,
  preloadFreeTicketGag,
  startFreeTicketGagFromGesture,
} from "@/lib/play-free-ticket-gag";
import { FREE_TICKET_FULL_SRC } from "@/lib/landing-media";
import {
  fireLandingJoinHook,
  markLandingConverted,
} from "@/lib/landing-return-visit";
import {
  defaultHowItWorks,
  howItWorksStepById,
  normalizeHowItWorks,
  type HowItWorksStepId,
} from "@/lib/how-it-works";
import { TICKET_TIERS } from "@/lib/landing-tickets";
import { resolveProgramImage } from "@/lib/program-constants";
import { TOP_LEVEL_PROGRAMS } from "@/lib/programs";

/**
 * See inside — tap-Next tour for cold traffic.
 * Five digestible screens (not a timer): workout → ticket → program → gear → book.
 * Ends at eight taps: four tickets by price, four programs.
 */

const TOUR_END_TICKETS = TICKET_TIERS.filter((t) =>
  ["free", "coach-class", "business-class", "first-class"].includes(t.id),
);

const TOUR_END_PROGRAMS = TOP_LEVEL_PROGRAMS.filter(
  (p) => p.category === "workout" && p.catalogStatus === "live",
).slice(0, 4);
const SET3_CONFETTI_HOLD_MS = 1800;

type TourBeat =
  | "w_set3"
  | "access_business"
  | "pick_adult"
  | "equip_all"
  | "book_confirm";

const TOUR_BEATS: TourBeat[] = [
  "w_set3",
  "access_business",
  "pick_adult",
  "equip_all",
  "book_confirm",
];

const TOUR_BEAT_TO_STEP: Record<TourBeat, HowItWorksStepId> = {
  w_set3: "workout",
  access_business: "ticket",
  pick_adult: "program",
  equip_all: "gear",
  book_confirm: "book",
};

export default function LandingSeeInsideTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState<"auto" | "end">("auto");
  const lastSetRef = useRef<HTMLDivElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);
  const [howItWorks, setHowItWorks] = useState(defaultHowItWorks);
  const [freeOpen, setFreeOpen] = useState(false);
  const [gagFullSrc, setGagFullSrc] = useState(FREE_TICKET_FULL_SRC);
  const [freeIntroUrl, setFreeIntroUrl] = useState<string | null>(null);
  const [welcomeUrl, setWelcomeUrl] = useState<string | null>(null);

  // Portal to body so sticky landing nav (z-40) can’t sit above the tour
  // (hero is z-0 and traps fixed children otherwise).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide fixed Light/Dark control while tour is open (it sat on Song/Skip/Close).
  // Tour is always dark cinematic — theme toggle would look “broken” anyway.
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.landingTour = "open";
    return () => {
      delete document.documentElement.dataset.landingTour;
    };
  }, [open]);

  /** Close wizard and land in normal join nav (tickets or programs). */
  const exitToSite = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Reset tour. Theme Song unlock is the global “tap anywhere” handler only
  // (one mute = corner speaker — no second control, no remute races).
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("auto");
    setBeat(0);
    confettiFired.current = false;
    setFreeOpen(false);
    void fetch("/api/landing-media", { cache: "no-store" })
      .then((res) => res.json())
      .then(
        (body: {
          howItWorks?: unknown;
          freeTicketFullUrl?: string | null;
          freeChastiseVideoUrl?: string | null;
          welcomeVideoUrl?: string | null;
        }) => {
          if (body.howItWorks) setHowItWorks(normalizeHowItWorks(body.howItWorks));
          if (body.freeTicketFullUrl) setGagFullSrc(body.freeTicketFullUrl);
          if (body.freeChastiseVideoUrl) setFreeIntroUrl(body.freeChastiseVideoUrl);
          if (body.welcomeVideoUrl) setWelcomeUrl(body.welcomeVideoUrl);
          preloadFreeTicketGag(body.freeTicketFullUrl || FREE_TICKET_FULL_SRC);
        },
      )
      .catch(() => {
        preloadFreeTicketGag(FREE_TICKET_FULL_SRC);
      });
  }, [open]);

  const goPrev = useCallback(() => {
    if (phase === "end") {
      setPhase("auto");
      setBeat(TOUR_BEATS.length - 1);
      return;
    }
    if (beat <= 0) return;
    setBeat((b) => b - 1);
  }, [phase, beat]);

  const goNext = useCallback(() => {
    if (phase === "end") return;
    if (beat >= TOUR_BEATS.length - 1) {
      setPhase("end");
      return;
    }
    setBeat((b) => b + 1);
  }, [phase, beat]);

  // Last set (set 3) fires confetti — same as live member console
  useEffect(() => {
    if (!open || phase !== "auto") return;
    const step = TOUR_BEATS[beat];
    if (step !== "w_set3") {
      confettiFired.current = false;
      return;
    }
    if (reducedMotion.current) return;

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled || confettiFired.current) return;
      confettiFired.current = true;
      const el = lastSetRef.current;
      const burstMs = Math.max(1200, SET3_CONFETTI_HOLD_MS - 200);
      if (el) {
        fireWorkoutConfetti(confettiOriginFromElement(el), burstMs);
      } else {
        fireWorkoutConfetti(undefined, burstMs);
      }
    }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, phase, beat]);

  useEffect(() => {
    if (!open) return;
    const img = new window.Image();
    img.src = "/images/tickets/business-class.jpg";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const current = phase === "auto" ? TOUR_BEATS[beat] : null;
  const progress =
    phase === "auto"
      ? ((beat + 1) / (TOUR_BEATS.length + 1)) * 100
      : 100;

  const howStep =
    current != null ? howItWorksStepById(howItWorks, TOUR_BEAT_TO_STEP[current]) : null;
  const coachLine =
    phase === "end"
      ? "Choose by price or by program — one tap and you’re in."
      : howStep?.coachLine || "";

  return createPortal(
    <>
    <div
      className="landing-see-inside force-dark fixed inset-0 z-[100] flex flex-col bg-[#07040f]" data-force-dark
      role="dialog"
      aria-modal="true"
      aria-labelledby="see-inside-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
            How it Works
          </p>
          <h2 id="see-inside-title" className="text-base font-semibold text-[var(--text)] sm:text-lg">
            {phase === "end"
              ? "Your move"
              : howItWorksStepById(howItWorks, TOUR_BEAT_TO_STEP[TOUR_BEATS[beat]]).title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {phase === "auto" ? (
            <button
              type="button"
              data-analytics-action="tour-skip"
              onClick={() => setPhase("end")}
              className="min-h-11 rounded-full border border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/90"
            >
              Skip
            </button>
          ) : null}
          <button
            type="button"
            data-analytics-action="close-tour"
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10 hover:text-[var(--text)]"
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mx-3 h-0.5 shrink-0 overflow-hidden rounded-full bg-white/10 sm:mx-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>

      <div
        className={`relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 ${
          phase === "end"
            ? "justify-start pt-3 sm:pt-5"
            : "justify-start pt-3 sm:justify-center sm:pt-1.5"
        }`}
      >
        <div
          className={`flex w-full flex-col items-center gap-2 px-1 sm:gap-2.5 sm:px-8 ${
            phase === "end" ? "max-w-xl" : "max-w-lg"
          }`}
        >
          {phase === "auto" && howStep ? (
            <div className="w-full">
              <HowItWorksScreen
                stepId={howStep.id}
                lastSetRef={lastSetRef}
                motion="animate"
                playKey={`${open}-${beat}`}
              />
            </div>
          ) : null}

          {/* ── END: exit wizard into normal site nav ── */}
          {phase === "end" && (
            <div className="w-full pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#f0c75e]">
                Choose by price
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TOUR_END_TICKETS.map((tier) => {
                  const art =
                    tier.seatArtSrc ||
                    `/images/tickets/${tier.id === "coach-class" ? "coach-class" : tier.id === "business-class" ? "business-class" : tier.id === "first-class" ? "first-class" : "free"}.jpg`;
                  const gold = tier.id === "business-class";
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      data-analytics-action={`tour-end-ticket-${tier.id}`}
                      onClick={(e) => {
                        markLandingConverted();
                        fireLandingJoinHook(e.currentTarget);
                        if (tier.signupPlan === "explorer") {
                          flushSync(() => setFreeOpen(true));
                          startFreeTicketGagFromGesture(
                            document.getElementById(FREE_TICKET_GAG_HOST_ID),
                          );
                          return;
                        }
                        exitToSite(`/signup?plan=${encodeURIComponent(tier.signupPlan)}`);
                      }}
                      className={`overflow-hidden rounded-xl border bg-[#1a0b2e] text-left transition active:scale-[0.98] ${
                        gold
                          ? "border-[#f0c75e] ring-2 ring-[#f0c75e]/50"
                          : "border-white/15 hover:border-[#a78bfa]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art} alt="" className="aspect-[4/3] w-full object-cover" />
                      <div className="px-2 py-1.5">
                        <p className="text-[12px] font-extrabold leading-tight text-white">{tier.title}</p>
                        <p className="text-[11px] font-semibold text-[#f0c75e]">{tier.price}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-fg)]">
                Choose by program
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TOUR_END_PROGRAMS.map((prog) => (
                  <button
                    key={prog.slug}
                    type="button"
                    data-analytics-action={`tour-end-program-${prog.slug}`}
                    onClick={(e) => {
                      markLandingConverted();
                      fireLandingJoinHook(e.currentTarget);
                      exitToSite(
                        `/signup?plan=explorer&interest=${encodeURIComponent(prog.slug)}`,
                      );
                    }}
                    className="overflow-hidden rounded-xl border border-white/15 bg-[#12081f] text-left transition hover:border-[#a78bfa] active:scale-[0.98]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveProgramImage(prog.slug)}
                      alt=""
                      className="h-[4.75rem] w-full object-cover sm:h-24"
                    />
                    <p className="px-2 py-1.5 text-[11px] font-semibold leading-snug text-white">
                      {prog.name}
                    </p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-analytics-action="tour-back"
                onClick={goPrev}
                className="mx-auto mt-4 flex min-h-12 items-center justify-center px-4 text-sm font-semibold text-white/70"
              >
                ← Back
              </button>
            </div>
          )}

          <p className="max-w-sm text-center text-[15px] font-semibold leading-snug text-[var(--text)] sm:text-base">
            {coachLine}
          </p>
        </div>
      </div>

      {/* Dots + thumb Next. No timer — too fast for some, too slow for others. */}
      <div
        className={`flex shrink-0 justify-center gap-1.5 pt-1 ${
          phase === "auto" ? "pb-1" : "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {TOUR_BEATS.map((_, i) => {
          const active = phase === "auto" && i === beat;
          const done = phase === "end" || (phase === "auto" && i < beat);
          return (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                active ? "w-5 bg-white" : done ? "w-2.5 bg-[#a78bfa]" : "w-2 bg-white/25"
              }`}
            />
          );
        })}
        <span
          className={`h-1.5 rounded-full transition-all ${
            phase === "end" ? "w-5 bg-white" : "w-2 bg-white/25"
          }`}
          aria-hidden
        />
      </div>

      {phase === "auto" ? (
        <div
          className="shrink-0 space-y-2 px-3 pt-1 sm:px-5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <HowItWorksVoice step={howStep} active={phase === "auto"} />
          <div className="flex gap-2">
            <button
              type="button"
              data-analytics-action="tour-back"
              onClick={goPrev}
              disabled={beat <= 0}
              className="inline-flex min-h-14 min-w-[5.5rem] items-center justify-center rounded-full border-2 border-white/70 px-5 text-[17px] font-extrabold text-white disabled:pointer-events-none disabled:opacity-30"
            >
              Back
            </button>
            <button
              type="button"
              data-analytics-action="tour-next"
              onClick={goNext}
              className="landing-hero-early-signup inline-flex min-h-14 flex-1 items-center justify-center rounded-full px-8 text-[19px] font-extrabold tracking-tight transition-transform active:scale-[0.98]"
            >
              {beat >= TOUR_BEATS.length - 1 ? "See tickets" : "Next"}
            </button>
          </div>
          <button
            type="button"
            data-analytics-action="tour-get-started"
            onClick={(e) => {
              markLandingConverted();
              fireLandingJoinHook(e.currentTarget);
              exitToSite("/join?from=tour#tickets");
            }}
            className="landing-hero-secondary-cta inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-[16px] font-extrabold tracking-tight transition-transform active:scale-[0.98]"
          >
            Get started
          </button>
        </div>
      ) : null}
    </div>
    <FreeTicketModal
      open={freeOpen}
      onClose={() => setFreeOpen(false)}
      onUpgrade={() => {
        setFreeOpen(false);
        exitToSite("/join?from=tour#tickets");
      }}
      freeChastiseVideoUrl={freeIntroUrl}
      welcomeVideoUrl={welcomeUrl}
      gagFullSrc={gagFullSrc}
      forceGag
    />
    </>,
    document.body
  );
}
