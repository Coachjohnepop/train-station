"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FreeTicketModal from "@/components/FreeTicketModal";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";
import { TICKET_TIERS, type TicketTierId } from "@/lib/landing-tickets";
import { TOP_LEVEL_PROGRAMS } from "@/lib/programs";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

/**
 * See inside — fully auto until the final fork (no slide-clicking).
 *
 * Demo: 5 actions × 2s (weight → set1 → set2 → set3 → confetti)
 * Then auto ticket highlight / pause 2s → land on Onboard | Program fork.
 * Ticket still selectable if user taps early; Free rickroll works.
 * Pay anytime; start date needs full onboard.
 */
const STEP_MS = 2000;

type Stage = "demo" | "tickets" | "fork" | "onboard" | "program" | "book";

/** Auto-play sequence (fork is interactive end) */
const AUTO_STAGES: Stage[] = ["demo", "tickets", "fork"];

const COACH: Record<Stage, string> = {
  demo: "Live session — weight, sets, finish. Watch it build.",
  tickets: "Choose your ticket — pay anytime after you pick.",
  fork: "Onboard (left) or pick a program (right). Start date needs full onboard.",
  onboard: "Full onboard unlocks your program start date. Pay is separate.",
  program: "Pick a track anytime. Start date waits until onboard is complete.",
  book: "Book Coach Jeremy — or skip and book later in the app.",
};

type DemoStep = "weight" | "set1" | "set2" | "set3" | "confetti";

export default function LandingSeeInsideTour({
  open,
  onClose,
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
}: {
  open: boolean;
  onClose: () => void;
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("demo");
  const [demoStep, setDemoStep] = useState<DemoStep>("weight");
  const [weight, setWeight] = useState(95);
  const [doneSets, setDoneSets] = useState<number[]>([]);
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const [plan, setPlan] = useState("explorer");
  const [programSlug, setProgramSlug] = useState<string | null>(null);
  const [didOnboard, setDidOnboard] = useState(false);
  const [didProgram, setDidProgram] = useState(false);
  const lastSetRef = useRef<HTMLButtonElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);
  const timers = useRef<number[]>([]);
  /** When true, stop auto-advance (user is on interactive fork/onboard/program/book) */
  const autoPaused = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const goSignup = useCallback(() => {
    const q = new URLSearchParams({ plan });
    if (programSlug) q.set("interest", programSlug);
    onClose();
    router.push(`/signup?${q.toString()}`);
  }, [onClose, plan, programSlug, router]);

  const enterFork = useCallback((signupPlan: string) => {
    clearTimers();
    autoPaused.current = true;
    setPlan(signupPlan);
    setFreeModalOpen(false);
    setDidOnboard(false);
    setDidProgram(false);
    setProgramSlug(null);
    setStage("fork");
  }, [clearTimers]);

  const pickTicket = useCallback(
    (tierId: TicketTierId, signupPlan: string) => {
      if (tierId === "free") {
        setPlan("explorer");
        setFreeModalOpen(true);
        autoPaused.current = true;
        clearTimers();
        return;
      }
      enterFork(signupPlan);
    },
    [enterFork, clearTimers],
  );

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    autoPaused.current = false;
    setStage("demo");
    setDemoStep("weight");
    setWeight(95);
    setDoneSets([]);
    confettiFired.current = false;
    setFreeModalOpen(false);
    setPlan("explorer");
    setProgramSlug(null);
    setDidOnboard(false);
    setDidProgram(false);
    clearTimers();
  }, [open, clearTimers]);

  // Full auto sequence: demo 5×2s → tickets 2s → fork (stop)
  useEffect(() => {
    if (!open) return;
    if (autoPaused.current) return;
    if (stage !== "demo" && stage !== "tickets") return;

    clearTimers();
    const step = reducedMotion.current ? 900 : STEP_MS;

    if (stage === "demo") {
      setDemoStep("weight");
      setWeight(95);
      setDoneSets([]);
      confettiFired.current = false;

      // 1) Weight
      later(0, () => {
        setDemoStep("weight");
        setWeight(135);
      });
      // 2) Set 1
      later(step, () => {
        setDemoStep("set1");
        setDoneSets([1]);
      });
      // 3) Set 2
      later(step * 2, () => {
        setDemoStep("set2");
        setDoneSets([1, 2]);
      });
      // 4) Set 3
      later(step * 3, () => {
        setDemoStep("set3");
        setDoneSets([1, 2, 3]);
      });
      // 5) Confetti / finish
      later(step * 4, () => {
        setDemoStep("confetti");
        setDoneSets([1, 2, 3]);
        if (!confettiFired.current && !reducedMotion.current) {
          confettiFired.current = true;
          const el = lastSetRef.current;
          if (el) fireWorkoutConfetti(confettiOriginFromElement(el));
        }
      });
      // Next slide: tickets
      later(step * 5, () => {
        if (!autoPaused.current) setStage("tickets");
      });
    }

    if (stage === "tickets") {
      // Auto show tickets 2s, then land on fork (user can still tap a ticket during the beat)
      later(step, () => {
        if (!autoPaused.current) {
          autoPaused.current = true;
          setStage("fork");
        }
      });
    }

    return clearTimers;
  }, [open, stage, later, clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const autoIndex =
    stage === "demo" ? 0 : stage === "tickets" ? 1 : stage === "fork" ? 2 : 2;
  const progress = ((autoIndex + 1) / AUTO_STAGES.length) * 100;
  const programs = TOP_LEVEL_PROGRAMS.filter((p) => p.catalogStatus !== "hidden");
  const planNorm = normalizeSignupPlan(plan);
  const planLabel = signupPlanLabel(planNorm);
  const isPaidPlan = planNorm !== "explorer";
  const weightHot = demoStep !== "weight" || weight >= 135;
  const statusLine =
    demoStep === "weight"
      ? "Logging weight · coach sees it live"
      : demoStep === "set1"
        ? "Set 1 done"
        : demoStep === "set2"
          ? "Set 2 done"
          : demoStep === "set3"
            ? "Set 3 done"
            : "Exercise complete — nice work";

  return (
    <div
      className="landing-see-inside fixed inset-0 z-[80] flex flex-col bg-[#07040f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="see-inside-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
            See inside
          </p>
          <h2 id="see-inside-title" className="text-sm font-semibold text-white sm:text-base">
            Station tour
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Close tour"
        >
          ✕
        </button>
      </div>

      <div className="mx-4 h-1 shrink-0 overflow-hidden rounded-full bg-white/10 sm:mx-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div
          key={stage}
          className="landing-see-inside__panel flex w-full max-w-md flex-col items-center gap-4"
        >
          {/* ── Demo (auto 5 × 2s) ── */}
          {stage === "demo" && (
            <div className="landing-see-inside__phone relative w-full max-w-[300px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#12081f] shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:max-w-[320px]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">
                    Live session
                  </p>
                  <p className="text-sm font-semibold text-white">Today · Lower day</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  LIVE
                </span>
              </div>
              <div className="space-y-3 p-3.5">
                <div className="rounded-xl border border-[#7c3aed]/35 bg-[#1a0b2e]/90 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#c4b5fd]/80">
                        Now
                      </p>
                      <h3 className="text-base font-semibold text-white">Goblet squat</h3>
                      <p className="mt-0.5 text-[11px] text-white/55">3 × 8 · Medium</p>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums transition-colors duration-500 ${
                        weightHot ? "text-[#fde68a]" : "text-white/70"
                      }`}
                    >
                      {weight}
                      <span className="ml-0.5 text-[10px] font-semibold text-white/45">lbs</span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <label className="flex min-w-[4.25rem] flex-col rounded-lg border border-white/15 bg-black/30 px-2 py-1.5">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">
                        Weight
                      </span>
                      <span
                        className={`text-lg font-bold tabular-nums leading-none transition-colors duration-500 ${
                          weightHot ? "text-[#fde68a]" : "text-white"
                        }`}
                      >
                        {weight}
                      </span>
                    </label>
                    {[1, 2, 3].map((n) => {
                      const done = doneSets.includes(n);
                      return (
                        <button
                          key={n}
                          ref={n === 3 ? lastSetRef : undefined}
                          type="button"
                          tabIndex={-1}
                          className={`flex h-12 flex-1 flex-col items-center justify-center rounded-lg border text-xs font-bold transition-colors duration-500 ${
                            done
                              ? "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                              : "border-white/15 bg-white/5 text-white/80"
                          }`}
                        >
                          <span className="text-base leading-none">{done ? "✓" : n}</span>
                          <span className="text-[8px] font-semibold uppercase opacity-70">Set</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 min-h-[1rem] text-[10px] font-medium text-[#c4b5fd]/90">
                    {statusLine}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Tickets (auto 2s, or tap to pick early) ── */}
          {stage === "tickets" && (
            <div className="w-full max-w-md">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Your level
              </p>
              <h3 className="mt-1 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Choose your ticket
              </h3>
              <p className="mt-1.5 text-center text-[12px] text-white/55">
                Tap a ticket, or wait — we&apos;ll continue automatically.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {TICKET_TIERS.map((tier) => {
                  const isFree = tier.id === "free";
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => pickTicket(tier.id, tier.signupPlan)}
                      className={`group relative flex min-h-[148px] flex-col overflow-hidden rounded-xl border text-left shadow-lg transition active:scale-[0.98] ${tier.themeClass}`}
                    >
                      {tier.seatArtSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tier.seatArtSrc}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-90"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
                      <div className="relative z-10 mt-auto flex flex-col p-2.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
                          {tier.subtitle}
                        </span>
                        <span className="text-sm font-bold text-white">{tier.title}</span>
                        <span className="mt-0.5 text-lg font-semibold text-white">
                          {tier.price}
                          {tier.priceNote ? (
                            <span className="ml-0.5 text-[10px] font-medium text-white/60">
                              {tier.priceNote}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 text-[10px] font-semibold text-[#c4b5fd]">
                          {isFree ? "Tap if you dare →" : "Select & pay anytime →"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Fork: end of auto tour ── */}
          {stage === "fork" && (
            <div className="w-full max-w-md">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                {planLabel} · your next step
              </p>
              <h3 className="mt-1 text-center text-2xl font-semibold text-white">
                How do you want to start?
              </h3>
              <p className="mt-1 text-center text-[12px] text-white/55">
                {isPaidPlan
                  ? "Pay anytime. Start date needs full onboard."
                  : "Free continues here. Start date needs full onboard."}
              </p>
              {isPaidPlan ? (
                <button
                  type="button"
                  onClick={goSignup}
                  className="landing-hero-early-signup mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-extrabold"
                >
                  Pay &amp; create account · {planLabel} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goSignup}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Create Free account now →
                </button>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDidOnboard(true);
                    setStage("onboard");
                  }}
                  className="flex min-h-[160px] flex-col items-start justify-between rounded-2xl border border-[#7c3aed]/45 bg-[#1a0b2e] p-4 text-left transition hover:border-[#a78bfa] hover:bg-[#241040]"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#a78bfa]">
                    Left
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Onboard</p>
                    <p className="mt-1 text-[12px] leading-snug text-white/60">
                      Full setup unlocks your <strong className="text-white/85">start date</strong>.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#c4b5fd]">Start setup →</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDidProgram(true);
                    setStage("program");
                  }}
                  className="flex min-h-[160px] flex-col items-start justify-between rounded-2xl border border-white/15 bg-[#12081f] p-4 text-left transition hover:border-[#7c3aed]/50 hover:bg-[#1a1428]"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                    Right
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Pick a program</p>
                    <p className="mt-1 text-[12px] leading-snug text-white/60">
                      Choose a track anytime. Start date still needs onboard.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#c4b5fd]">Choose track →</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Onboard (from fork only) ── */}
          {stage === "onboard" && (
            <div className="w-full max-w-sm rounded-3xl border border-[#7c3aed]/40 bg-[#140a22] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a78bfa]">
                Onboarding
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white">Full setup unlocks start date</h3>
              <ol className="mt-4 space-y-2.5 text-sm text-white/85">
                <li className="flex gap-2">
                  <span className="font-bold text-[#c4b5fd]">1.</span> Name, phone for workout texts
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[#c4b5fd]">2.</span> Gear / home equipment (optional)
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-300/90">3.</span>
                  <span>
                    <strong className="text-white">Program start date</strong>
                    <span className="mt-0.5 block text-[11px] text-white/50">
                      Only after full onboard is complete.
                    </span>
                  </span>
                </li>
              </ol>
              <div className="mt-4 flex flex-col gap-2">
                {isPaidPlan ? (
                  <button
                    type="button"
                    onClick={goSignup}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[#a78bfa]/50 bg-[#7c3aed]/25 text-sm font-semibold text-white"
                  >
                    Pay now · {planLabel} →
                  </button>
                ) : null}
                {!didProgram ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDidProgram(true);
                      setStage("program");
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white"
                  >
                    Or pick a program →
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStage("book")}
                  className="landing-hero-early-signup inline-flex h-12 items-center justify-center rounded-full text-[15px] font-extrabold"
                >
                  Continue to book Coach Jeremy →
                </button>
              </div>
            </div>
          )}

          {/* ── Program (from fork only) ── */}
          {stage === "program" && (
            <div className="w-full max-w-md">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Program
              </p>
              <h3 className="mt-1 text-center text-xl font-semibold text-white">
                Pick your training track
              </h3>
              <p className="mt-1 text-center text-[11px] text-white/50">
                Start date locked until full onboard.
              </p>
              <div className="mt-3 max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                {programs.map((p) => {
                  const active = programSlug === p.slug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setProgramSlug(p.slug)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-[#7c3aed] bg-[#7c3aed]/20"
                          : "border-white/12 bg-white/[0.04] hover:border-[#7c3aed]/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{p.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-white/50">
                        {p.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {isPaidPlan ? (
                  <button
                    type="button"
                    onClick={goSignup}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[#a78bfa]/50 bg-[#7c3aed]/25 text-sm font-semibold text-white"
                  >
                    Pay now · {planLabel} →
                  </button>
                ) : null}
                {!didOnboard ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDidOnboard(true);
                      setStage("onboard");
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white"
                  >
                    Or finish onboard (unlock start date) →
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!programSlug}
                  onClick={() => setStage("book")}
                  className="landing-hero-early-signup inline-flex h-12 items-center justify-center rounded-full text-[15px] font-extrabold disabled:opacity-40"
                >
                  Continue to book Coach Jeremy →
                </button>
              </div>
            </div>
          )}

          {/* ── Book ── */}
          {stage === "book" && (
            <div className="w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-[#0c1a14] p-5">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/90">
                You meet here
              </p>
              <h3 className="mt-2 text-center text-xl font-semibold text-white">
                Book with Coach Jeremy
              </h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/12 bg-[#0a0612]/90">
                <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/30 text-sm font-bold text-[#e9d5ff]">
                    JB
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold text-white">Coach Jeremy Byrd</p>
                    <p className="text-[11px] text-emerald-300/90">15-min intro · Calendly</p>
                  </div>
                </div>
                <div className="border-t border-white/10 px-3 py-2.5">
                  <div className="flex h-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-[#042f1a]">
                    Book Call · Coach Jeremy
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={goSignup}
                  className="landing-hero-early-signup inline-flex h-12 items-center justify-center rounded-full text-[15px] font-extrabold"
                >
                  {isPaidPlan
                    ? `Pay & create account · ${planLabel} →`
                    : `Create Free account · ${planLabel} →`}
                </button>
                <button
                  type="button"
                  onClick={goSignup}
                  className="text-xs font-semibold text-white/50 underline decoration-white/25 underline-offset-4 hover:text-white"
                >
                  Skip book for now — Book Call later in the app
                </button>
              </div>
            </div>
          )}

          <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold leading-snug text-white sm:text-base">
            {COACH[stage]}
          </p>
        </div>
      </div>

      <div
        className="flex shrink-0 justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
        aria-hidden
      >
        {AUTO_STAGES.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              s === stage || (stage !== "demo" && stage !== "tickets" && s === "fork")
                ? i === autoIndex || (stage !== "demo" && stage !== "tickets" && s === "fork")
                  ? "w-6 bg-white"
                  : "w-3 bg-[#a78bfa]"
                : i < autoIndex
                  ? "w-3 bg-[#a78bfa]"
                  : "w-2 bg-white/25"
            }`}
          />
        ))}
      </div>

      <FreeTicketModal
        open={freeModalOpen}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        welcomeVideoUrl={welcomeVideoUrl}
        purchaseAuth={{ signedIn: false }}
        onClose={() => setFreeModalOpen(false)}
        onUpgrade={() => setFreeModalOpen(false)}
        onContinueFree={() => enterFork("explorer")}
      />
    </div>
  );
}
