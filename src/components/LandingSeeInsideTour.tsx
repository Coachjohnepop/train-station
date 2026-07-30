"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";

/**
 * Cold-traffic “See inside” — hero-style auto-scroll (~2s / screen, ~20s total).
 * In-app live demo → Business Class fast signup → book first appointment → board.
 */
const TICKETS_HREF = "/join?from=tour#programs";
const BUSINESS_SIGNUP = "/signup?plan=business";
const SCREEN_MS = 2200;

type ScreenId =
  | "session"
  | "weight"
  | "sets"
  | "confetti"
  | "signup"
  | "book"
  | "board";

const SCREENS: { id: ScreenId; coach: string }[] = [
  {
    id: "session",
    coach: "You’re in a live session — today’s work on your phone.",
  },
  {
    id: "weight",
    coach: "Log the weight you used. Coach sees it live.",
  },
  {
    id: "sets",
    coach: "Tap each set as you finish. Simple. Accountable.",
  },
  {
    id: "confetti",
    coach: "Last set? Celebrate — then keep the train moving.",
  },
  {
    id: "signup",
    coach: "Fast board: Business Class in under a minute.",
  },
  {
    id: "book",
    coach: "Book your first appointment — coach call, then you train.",
  },
  {
    id: "board",
    coach: "Ready? Pick a program, choose your ticket, ride.",
  },
];

export default function LandingSeeInsideTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [weight, setWeight] = useState(95);
  const [doneSets, setDoneSets] = useState<number[]>([]);
  const lastSetRef = useRef<HTMLButtonElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);
  const paused = useRef(false);

  const goTickets = useCallback(() => {
    onClose();
    router.push(TICKETS_HREF);
  }, [onClose, router]);

  const goBusinessSignup = useCallback(() => {
    onClose();
    router.push(BUSINESS_SIGNUP);
  }, [onClose, router]);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIndex(0);
    setWeight(95);
    setDoneSets([]);
    confettiFired.current = false;
    paused.current = false;
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [open]);

  // Snap scroller to current index
  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (!child) return;
    child.scrollIntoView({
      behavior: reducedMotion.current ? "auto" : "smooth",
      inline: "start",
      block: "nearest",
    });
  }, [open, index]);

  // Auto-advance ~2s per screen
  useEffect(() => {
    if (!open) return;
    if (index >= SCREENS.length - 1) {
      // Hold last screen a beat, then tickets
      const end = window.setTimeout(
        () => {
          if (!paused.current) goTickets();
        },
        reducedMotion.current ? 1200 : SCREEN_MS,
      );
      return () => window.clearTimeout(end);
    }
    const ms = reducedMotion.current ? 1400 : SCREEN_MS;
    const id = window.setTimeout(() => {
      if (!paused.current) setIndex((i) => Math.min(i + 1, SCREENS.length - 1));
    }, ms);
    return () => window.clearTimeout(id);
  }, [open, index, goTickets]);

  // Weight animation on weight screen
  useEffect(() => {
    if (!open || SCREENS[index]?.id !== "weight") return;
    if (reducedMotion.current) {
      setWeight(135);
      return;
    }
    setWeight(95);
    const t1 = window.setTimeout(() => setWeight(115), 500);
    const t2 = window.setTimeout(() => setWeight(135), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, index]);

  // Sets on sets screen
  useEffect(() => {
    if (!open || SCREENS[index]?.id !== "sets") return;
    setDoneSets([]);
    if (reducedMotion.current) {
      setDoneSets([1, 2]);
      return;
    }
    const t1 = window.setTimeout(() => setDoneSets([1]), 400);
    const t2 = window.setTimeout(() => setDoneSets([1, 2]), 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, index]);

  // Confetti on confetti screen
  useEffect(() => {
    if (!open || SCREENS[index]?.id !== "confetti") return;
    setDoneSets([1, 2]);
    const markLast = window.setTimeout(() => {
      setDoneSets([1, 2, 3]);
      if (confettiFired.current) return;
      confettiFired.current = true;
      const el = lastSetRef.current;
      if (el && !reducedMotion.current) {
        fireWorkoutConfetti(confettiOriginFromElement(el));
      }
    }, reducedMotion.current ? 150 : 500);
    return () => window.clearTimeout(markLast);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        paused.current = true;
        setIndex((i) => Math.min(i + 1, SCREENS.length - 1));
      }
      if (e.key === "ArrowLeft") {
        paused.current = true;
        setIndex((i) => Math.max(i - 1, 0));
      }
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

  const progress = (index + 1) / SCREENS.length;
  const setsComplete = doneSets;

  function WorkoutPhone({
    beatId,
  }: {
    beatId: "session" | "weight" | "sets" | "confetti";
  }) {
    return (
      <div className="landing-see-inside__phone relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#12081f] shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:max-w-[320px]">
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
                className={`text-xs font-bold tabular-nums transition-all duration-300 ${
                  beatId !== "session" ? "scale-110 text-[#fde68a]" : "text-white/70"
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
                  className={`text-lg font-bold tabular-nums leading-none ${
                    beatId !== "session" ? "text-[#fde68a]" : "text-white"
                  }`}
                >
                  {weight}
                </span>
              </label>
              {[1, 2, 3].map((n) => {
                const done = setsComplete.includes(n);
                const isLast = n === 3;
                return (
                  <button
                    key={n}
                    ref={isLast ? lastSetRef : undefined}
                    type="button"
                    tabIndex={-1}
                    className={`flex h-12 flex-1 flex-col items-center justify-center rounded-lg border text-xs font-bold transition-all duration-300 ${
                      done
                        ? "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a] shadow-[0_0_18px_rgba(212,175,55,0.35)]"
                        : "border-white/15 bg-white/5 text-white/80"
                    } ${beatId === "confetti" && isLast && done ? "scale-105" : ""}`}
                    aria-label={`Set ${n}${done ? " done" : ""}`}
                  >
                    <span className="text-base leading-none">{done ? "✓" : n}</span>
                    <span className="text-[8px] font-semibold uppercase opacity-70">Set</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] font-medium text-[#c4b5fd]/90">
              {beatId === "session" && "Coach Jeremy is on the floor with you."}
              {beatId === "weight" && "Weight updated · coach sees 135"}
              {beatId === "sets" && `${setsComplete.length}/3 sets logged`}
              {beatId === "confetti" &&
                (setsComplete.length === 3
                  ? "Exercise complete — nice work"
                  : "Finish strong")}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 opacity-60">
            <p className="text-[11px] font-semibold text-white/70">Next · Push-up</p>
            <p className="text-[10px] text-white/40">3 × 10 · Bodyweight</p>
          </div>
        </div>
      </div>
    );
  }

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
            ~20-second station tour
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goTickets}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mx-4 h-1 shrink-0 overflow-hidden rounded-full bg-white/10 sm:mx-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Hero-style horizontal auto-scroll screens */}
      <div
        ref={scrollerRef}
        className="landing-see-inside__scroller flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
        onPointerDown={() => {
          paused.current = true;
        }}
      >
        {/* 0–3: workout demo */}
        {(["session", "weight", "sets", "confetti"] as const).map((id) => (
          <section
            key={id}
            className="landing-see-inside__screen flex h-full w-full min-w-full shrink-0 snap-start flex-col items-center justify-center gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
          >
            <WorkoutPhone beatId={id} />
            <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold leading-snug text-white sm:text-base">
              {SCREENS.find((s) => s.id === id)?.coach}
            </p>
          </section>
        ))}

        {/* 4: Business Class fast signup */}
        <section className="landing-see-inside__screen flex h-full w-full min-w-full shrink-0 snap-start flex-col items-center justify-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <div className="w-full max-w-sm rounded-3xl border border-[#7c3aed]/40 bg-[#140a22] p-5 shadow-[0_20px_60px_rgba(124,58,237,0.25)]">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#a78bfa]">
              Fast signup
            </p>
            <div className="mx-auto mt-3 max-w-[200px] overflow-hidden rounded-xl border border-white/10 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tickets/business-class.jpg"
                alt="Business Class seat"
                className="h-auto w-full object-cover"
                width={400}
                height={280}
              />
            </div>
            <h3 className="mt-3 text-center text-xl font-semibold text-white">
              Business Class
            </h3>
            <p className="mt-1 text-center text-2xl font-bold text-white">
              $50<span className="text-sm font-medium text-white/50">/mo</span>
            </p>
            <ul className="mt-3 space-y-1 text-center text-[12px] text-white/70">
              <li>Full member access · all programs</li>
              <li>Business billing · coach tools</li>
              <li>Email + password — under a minute</li>
            </ul>
            <button
              type="button"
              onClick={goBusinessSignup}
              className="landing-hero-early-signup mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-extrabold"
            >
              Board Business Class →
            </button>
            <p className="mt-2 text-center text-[11px] text-white/45">
              Or keep watching — book call is next
            </p>
          </div>
          <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold text-white">
            {SCREENS.find((s) => s.id === "signup")?.coach}
          </p>
        </section>

        {/* 5: Book first appointment */}
        <section className="landing-see-inside__screen flex h-full w-full min-w-full shrink-0 snap-start flex-col items-center justify-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-[#0c1a14] p-5 shadow-[0_20px_60px_rgba(16,185,129,0.15)]">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/90">
              Get started
            </p>
            <h3 className="mt-2 text-center text-xl font-semibold text-white">
              Book your first appointment
            </h3>
            <ol className="mt-4 space-y-3 text-left text-sm text-white/85">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                  1
                </span>
                <span>
                  <strong className="text-white">Create account</strong>
                  <span className="mt-0.5 block text-[12px] text-white/55">
                    Pick your ticket — Business Class is ready when you are.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                  2
                </span>
                <span>
                  <strong className="text-white">Book a coach call</strong>
                  <span className="mt-0.5 block text-[12px] text-white/55">
                    Calendly on Book Call — Jeremy sets your start date &amp; plan.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
                  3
                </span>
                <span>
                  <strong className="text-white">Train on Today</strong>
                  <span className="mt-0.5 block text-[12px] text-white/55">
                    Same live console you just saw — weight, sets, confetti.
                  </span>
                </span>
              </li>
            </ol>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-center text-[12px] text-white/65">
              After signup → <span className="font-semibold text-emerald-300">Book Call</span> in
              the app · or email{" "}
              <span className="text-white/90">jeremy@thetrainstation.co</span>
            </div>
          </div>
          <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold text-white">
            {SCREENS.find((s) => s.id === "book")?.coach}
          </p>
        </section>

        {/* 6: Board CTA */}
        <section className="landing-see-inside__screen flex h-full w-full min-w-full shrink-0 snap-start flex-col items-center justify-center gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#c4b5fd]">
            The Train Station
          </p>
          <h3 className="max-w-xs text-center text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            Ready to board?
          </h3>
          <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold text-white/90">
            {SCREENS.find((s) => s.id === "board")?.coach}
          </p>
          <div className="flex w-full max-w-sm flex-col gap-2.5">
            <button
              type="button"
              onClick={goTickets}
              className="landing-hero-early-signup landing-hero-cta-pulse inline-flex h-14 w-full items-center justify-center rounded-full text-[17px] font-extrabold"
            >
              Choose program &amp; ticket
            </button>
            <button
              type="button"
              onClick={goBusinessSignup}
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Fast path: Business Class signup
            </button>
          </div>
        </section>
      </div>

      {/* Dots */}
      <div
        className="flex shrink-0 justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
        aria-hidden
      >
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-white" : i < index ? "w-3 bg-[#a78bfa]" : "w-2 bg-white/25"
            }`}
            onClick={() => {
              paused.current = true;
              setIndex(i);
            }}
            aria-label={`Go to screen ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
