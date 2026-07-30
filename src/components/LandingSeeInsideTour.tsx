"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";

/**
 * Cold-traffic “See inside” tour — ~15s guided learning beats, then ticket pick.
 * Beats: live session → weight change → set checks → last-set confetti → choose ticket.
 */
const TICKETS_HREF = "/join?from=tour#tickets";

type Beat = {
  id: string;
  coach: string;
  durationMs: number;
};

const BEATS: Beat[] = [
  {
    id: "session",
    coach: "You’re in a live session — today’s work on your phone.",
    durationMs: 3800,
  },
  {
    id: "weight",
    coach: "Log the weight you used. Coach sees it in real time.",
    durationMs: 4000,
  },
  {
    id: "sets",
    coach: "Tap each set as you finish. Simple. Accountable.",
    durationMs: 4200,
  },
  {
    id: "confetti",
    coach: "Last set? Celebrate — then keep the train moving.",
    durationMs: 4200,
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
  const [beat, setBeat] = useState(0);
  const [weight, setWeight] = useState(95);
  const [doneSets, setDoneSets] = useState<number[]>([]);
  const lastSetRef = useRef<HTMLButtonElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);

  const goTickets = useCallback(() => {
    onClose();
    router.push(TICKETS_HREF);
  }, [onClose, router]);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setBeat(0);
    setWeight(95);
    setDoneSets([]);
    confettiFired.current = false;
  }, [open]);

  // Auto-advance beats
  useEffect(() => {
    if (!open) return;
    if (beat >= BEATS.length) {
      const end = window.setTimeout(goTickets, reducedMotion.current ? 400 : 900);
      return () => window.clearTimeout(end);
    }
    const ms = reducedMotion.current
      ? Math.min(BEATS[beat].durationMs, 2200)
      : BEATS[beat].durationMs;
    const id = window.setTimeout(() => setBeat((b) => b + 1), ms);
    return () => window.clearTimeout(id);
  }, [open, beat, goTickets]);

  // Weight animation on beat 1
  useEffect(() => {
    if (!open || beat !== 1) return;
    if (reducedMotion.current) {
      setWeight(135);
      return;
    }
    setWeight(95);
    const t1 = window.setTimeout(() => setWeight(115), 900);
    const t2 = window.setTimeout(() => setWeight(135), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, beat]);

  // Set checks on beat 2
  useEffect(() => {
    if (!open || beat !== 2) return;
    setDoneSets([]);
    if (reducedMotion.current) {
      setDoneSets([1, 2]);
      return;
    }
    const t1 = window.setTimeout(() => setDoneSets([1]), 700);
    const t2 = window.setTimeout(() => setDoneSets([1, 2]), 2200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, beat]);

  // Last set + confetti on beat 3
  useEffect(() => {
    if (!open || beat !== 3) return;
    setDoneSets([1, 2]);
    const markLast = window.setTimeout(() => {
      setDoneSets([1, 2, 3]);
      if (confettiFired.current) return;
      confettiFired.current = true;
      const el = lastSetRef.current;
      if (el && !reducedMotion.current) {
        fireWorkoutConfetti(confettiOriginFromElement(el));
      }
    }, reducedMotion.current ? 200 : 900);
    return () => window.clearTimeout(markLast);
  }, [open, beat]);

  // Escape closes → tickets still available via secondary
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const active = Math.min(beat, BEATS.length - 1);
  const coachLine =
    beat >= BEATS.length
      ? "Ready? Pick how you want to board."
      : BEATS[active].coach;
  const progress = Math.min(beat + 1, BEATS.length) / BEATS.length;
  const setsComplete = doneSets;

  return (
    <div
      className="landing-see-inside fixed inset-0 z-[80] flex flex-col bg-[#07040f]/96 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="see-inside-title"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
            See inside
          </p>
          <h2 id="see-inside-title" className="text-sm font-semibold text-white sm:text-base">
            15-second member tour
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goTickets}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10"
          >
            Skip to tickets
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

      <div className="mx-4 h-1 overflow-hidden rounded-full bg-white/10 sm:mx-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:gap-6">
        {/* Phone mock — live session console */}
        <div className="landing-see-inside__phone relative w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#12081f] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
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
                    beat >= 1 ? "scale-110 text-[#fde68a]" : "text-white/70"
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
                      beat >= 1 ? "text-[#fde68a]" : "text-white"
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
                      } ${beat === 3 && isLast && done ? "scale-105" : ""}`}
                      aria-label={`Set ${n}${done ? " done" : ""}`}
                    >
                      <span className="text-base leading-none">{done ? "✓" : n}</span>
                      <span className="text-[8px] font-semibold uppercase opacity-70">
                        Set
                      </span>
                    </button>
                  );
                })}
              </div>

              {beat >= 1 ? (
                <p className="mt-2 text-[10px] font-medium text-[#c4b5fd]/90">
                  {beat === 1
                    ? "Weight updated · coach sees 135"
                    : beat === 2
                      ? `${setsComplete.length}/3 sets logged`
                      : setsComplete.length === 3
                        ? "Exercise complete — nice work"
                        : "Finish strong"}
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-white/45">
                  Coach Jeremy is on the floor with you.
                </p>
              )}
            </div>

            <div
              className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-opacity duration-500 ${
                beat === 0 ? "opacity-100" : "opacity-50"
              }`}
            >
              <p className="text-[11px] font-semibold text-white/70">Next · Push-up</p>
              <p className="text-[10px] text-white/40">3 × 10 · Bodyweight</p>
            </div>
          </div>
        </div>

        {/* Coach line */}
        <p
          key={beat}
          className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold leading-snug text-white sm:text-base"
        >
          {coachLine}
        </p>

        <div className="flex gap-1.5" aria-hidden>
          {BEATS.map((b, i) => (
            <span
              key={b.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active && beat < BEATS.length
                  ? "w-6 bg-white"
                  : i < beat
                    ? "w-3 bg-[#a78bfa]"
                    : "w-2 bg-white/25"
              }`}
            />
          ))}
        </div>

        {beat >= BEATS.length - 1 ? (
          <button
            type="button"
            onClick={goTickets}
            className="landing-hero-early-signup landing-hero-cta-pulse inline-flex h-12 w-full max-w-sm items-center justify-center rounded-full px-8 text-[15px] font-extrabold tracking-tight sm:h-12"
          >
            Choose your ticket
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setBeat((b) => Math.min(b + 1, BEATS.length))}
            className="text-xs font-semibold text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
