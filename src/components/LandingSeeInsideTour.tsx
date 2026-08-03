"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";
import { PROGRAM_IMAGES } from "@/lib/program-constants";

/**
 * See inside — full auto-play tour for cold traffic only.
 *
 * Auto: workout ×5 → Business → Adult → equip blank/all → book open/day/confirm
 * Ends at “Where next?” → exits into normal site nav (/join#tickets | /join#programs).
 * Wizard never continues after that. Members never see this (home is welcome shell).
 */
const STEP_MS = 2000;
/** Last set + confetti: hold so burst can play before next slide */
const SET3_CONFETTI_HOLD_MS = 3600;
/** After workout (access, program, gear, book) — slower so it doesn’t blur past */
const AFTER_WORKOUT_MS = 3200;

type AutoBeat =
  | "w_weight"
  | "w_set1"
  | "w_set2"
  /** Last set — checks set 3 and fires confetti (same as live member console) */
  | "w_set3"
  | "access_business"
  | "pick_adult"
  | "equip_blank"
  | "equip_all"
  | "book_open"
  | "book_day"
  | "book_confirm";

const AUTO_BEATS: AutoBeat[] = [
  "w_weight",
  "w_set1",
  "w_set2",
  "w_set3",
  "access_business",
  "pick_adult",
  "equip_blank",
  "equip_all",
  "book_open",
  "book_day",
  "book_confirm",
];

const DEMO_EQUIPMENT = [
  { id: "dumbbells", name: "Dumbbells", img: "/images/equipment/dumbbells.jpg" },
  { id: "kettlebell", name: "Kettlebell", img: "/images/equipment/kettlebell.jpg" },
  { id: "bands", name: "Resistance bands", img: "/images/equipment/resistance-bands.jpg" },
  { id: "bench", name: "Bench", img: "/images/equipment/bench.jpg" },
  { id: "mat", name: "Yoga mat", img: "/images/equipment/yoga-mat.jpg" },
];

const BOOK_SLOTS = ["Tue · 11:00 AM", "Tue · 1:00 PM", "Wed · 2:45 PM"];

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
  const timers = useRef<number[]>([]);
  const paused = useRef(false);

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

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

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
    paused.current = false;
    setPhase("auto");
    setBeat(0);
    confettiFired.current = false;
    clearTimers();
  }, [open, clearTimers]);

  function holdMsForBeat(index: number): number {
    if (reducedMotion.current) return 1000;
    const id = AUTO_BEATS[index];
    // Last set + confetti — hold long enough for the burst
    if (id === "w_set3") return SET3_CONFETTI_HOLD_MS;
    // Everything after workout
    const set3Idx = AUTO_BEATS.indexOf("w_set3");
    if (index > set3Idx) return AFTER_WORKOUT_MS;
    return STEP_MS;
  }

  const goPrev = useCallback(() => {
    paused.current = true;
    clearTimers();
    if (phase === "end") {
      // From “Where next?” back into auto sequence at last beat
      setPhase("auto");
      setBeat(AUTO_BEATS.length - 1);
      return;
    }
    if (beat <= 0) return;
    setBeat((b) => b - 1);
  }, [phase, beat, clearTimers]);

  const goNext = useCallback(() => {
    paused.current = true;
    clearTimers();
    if (phase === "end") {
      // Stay on choices — only explicit card taps exit the wizard
      return;
    }
    if (beat >= AUTO_BEATS.length - 1) {
      setPhase("end");
      return;
    }
    setBeat((b) => b + 1);
  }, [phase, beat, clearTimers]);

  // Auto-advance (paused after manual arrow)
  useEffect(() => {
    if (!open || phase !== "auto" || paused.current) return;
    clearTimers();
    const ms = holdMsForBeat(beat);
    const id = window.setTimeout(() => {
      if (paused.current) return;
      if (beat >= AUTO_BEATS.length - 1) {
        setPhase("end");
        return;
      }
      setBeat((b) => b + 1);
    }, ms);
    timers.current.push(id);
    return clearTimers;
  }, [open, phase, beat, clearTimers]);

  // Last set (set 3) fires confetti — same as live member console
  useEffect(() => {
    if (!open || phase !== "auto") return;
    const step = AUTO_BEATS[beat];
    if (step !== "w_set3") return;
    if (reducedMotion.current) return;

    let cancelled = false;
    // Fire as set 3 checks (small delay so checkmark paints first)
    const t = window.setTimeout(() => {
      if (cancelled || confettiFired.current) return;
      confettiFired.current = true;
      const el = lastSetRef.current;
      const burstMs = Math.max(2400, SET3_CONFETTI_HOLD_MS - 400);
      if (el) {
        fireWorkoutConfetti(confettiOriginFromElement(el), burstMs);
      } else {
        fireWorkoutConfetti(undefined, burstMs);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, phase, beat]);

  // Preload Business Class art so confetti → access doesn't flash a blank load
  useEffect(() => {
    if (!open) return;
    const img = new window.Image();
    img.src = "/images/tickets/business-class.jpg";
    const adult = new window.Image();
    adult.src = PROGRAM_IMAGES.adult || "/images/programs/adult.jpg";
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

  const current = phase === "auto" ? AUTO_BEATS[beat] : null;
  const progress =
    phase === "auto"
      ? ((beat + 1) / (AUTO_BEATS.length + 1)) * 100
      : 100;

  const onWorkout =
    current === "w_weight" ||
    current === "w_set1" ||
    current === "w_set2" ||
    current === "w_set3";

  const displayWeight = onWorkout ? 135 : 95;

  // Progressive checks — set 3 + confetti on last set (live console behavior)
  const doneSets =
    current === "w_set1"
      ? [1]
      : current === "w_set2"
        ? [1, 2]
        : current === "w_set3"
          ? [1, 2, 3]
          : [];
  const set3JustDone = current === "w_set3";
  const celebrating = current === "w_set3";

  const equipSelected = current === "equip_all";
  const bookDayIndex =
    current === "book_day" || current === "book_confirm" ? 0 : -1;
  const bookDone = current === "book_confirm";

  const coachLine =
    phase === "end"
      ? "Ticket, program, or Create Account & Pay — all open the real site. Wizard ends here."
      : current === "w_weight"
        ? "Log the weight you used."
        : current === "w_set1"
          ? "Set 1 complete."
          : current === "w_set2"
            ? "Set 2 complete."
            : current === "w_set3"
              ? "Exercise Finished."
            : current === "access_business"
              ? "How to access — pick a ticket class (Business Class demo)."
              : current === "pick_adult"
                ? "Pick a program — Adult shown."
                : current === "equip_blank"
                  ? "Your gear list starts empty."
                  : current === "equip_all"
                    ? "Tap what you have at home — five items selected."
                    : current === "book_open"
                      ? "Book Call with Coach Jeremy."
                      : current === "book_day"
                        ? "Pick an open day and time."
                        : "Booked — intro call locked in.";

  return createPortal(
    <div
      className="landing-see-inside fixed inset-0 z-[100] flex flex-col bg-[#07040f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="see-inside-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.4rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#c4b5fd]">
            Free Quick Tour
          </p>
          <h2 id="see-inside-title" className="text-xs font-semibold text-white sm:text-sm">
            Station tour
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {phase === "auto" ? (
            <button
              type="button"
              onClick={() => {
                paused.current = true;
                clearTimers();
                setPhase("end");
              }}
              className="h-8 rounded-full border border-white/20 bg-white/5 px-2.5 text-[11px] font-semibold text-white/85"
            >
              Skip to choices
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
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
        className={`relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
          phase === "end"
            ? "justify-start pt-3 sm:pt-5"
            : "justify-center pt-1.5"
        }`}
      >
        {/* Left / right nav */}
        <button
          type="button"
          onClick={goPrev}
          disabled={phase === "auto" && beat === 0}
          className={`absolute left-1.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-25 sm:left-3 ${
            phase === "end" ? "top-8" : "top-1/2 -translate-y-1/2"
          }`}
          aria-label="Previous step"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          className={`absolute right-1.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white/15 sm:right-3 ${
            phase === "end" ? "top-8" : "top-1/2 -translate-y-1/2"
          }`}
          aria-label="Next step"
        >
          ›
        </button>

        <div
          className={`flex w-full flex-col items-center gap-1.5 px-8 sm:gap-2 sm:px-10 ${
            phase === "end" ? "max-w-lg" : "max-w-md"
          }`}
        >
          {/* Stacked slides — only during auto (stage min-height would leave a blank band on end) */}
          {phase === "auto" ? (
          <div className="landing-see-inside__stage">
          {/* ── Workout phone ── */}
            <div
              className={`landing-see-inside__slide w-full ${
                onWorkout
                  ? "landing-see-inside__slide--active flex flex-col items-center"
                  : "landing-see-inside__slide--idle"
              }`}
              aria-hidden={!onWorkout}
            >
            <div className="w-full max-w-[270px] overflow-hidden rounded-2xl border border-white/15 bg-[#12081f] shadow-[0_16px_48px_rgba(0,0,0,0.65)] sm:max-w-[290px]">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#a78bfa]">
                    Live session
                  </p>
                  <p className="text-sm font-semibold leading-tight text-white">Today · Lower day</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                  LIVE
                </span>
              </div>
              <div className="p-2.5">
                <div className="rounded-lg border border-[#7c3aed]/35 bg-[#1a0b2e]/90 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase text-[#c4b5fd]/80">Now</p>
                      <h3 className="text-[15px] font-semibold leading-tight text-white">
                        Goblet squat
                      </h3>
                      <p className="text-[10px] text-white/55">3 × 8 · Medium</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-[#fde68a]">
                      {displayWeight}
                      <span className="ml-0.5 text-[9px] text-white/45">lbs</span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-1.5">
                    <label className="flex min-w-[3.75rem] flex-col rounded-md border border-white/15 bg-black/30 px-1.5 py-1">
                      <span className="text-[7px] font-bold uppercase text-white/40">Weight</span>
                      <span className="text-base font-bold tabular-nums leading-none text-[#fde68a]">
                        {displayWeight}
                      </span>
                    </label>
                    {[1, 2, 3].map((n) => {
                      const done = doneSets.includes(n);
                      const isThird = n === 3;
                      return (
                        <div
                          key={n}
                          ref={isThird ? lastSetRef : undefined}
                          className={`flex h-10 flex-1 flex-col items-center justify-center rounded-md border text-[11px] font-bold transition-colors duration-500 ${
                            done
                              ? isThird && set3JustDone
                                ? "border-[#c4b5fd]/70 bg-[#7c3aed]/25 text-[#e9d5ff]"
                                : celebrating && isThird
                                  ? "border-[#d4af37]/70 bg-[#d4af37]/30 text-[#fde68a] scale-105"
                                  : "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                              : "border-white/15 bg-white/5 text-white/80"
                          }`}
                        >
                          <span className="text-sm leading-none">{done ? "✓" : n}</span>
                          <span className="text-[7px] uppercase opacity-70">Set</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            </div>

          {/* ── How to Access · Business Class ── */}
            <div
              className={`landing-see-inside__slide w-full ${
                current === "access_business"
                  ? "landing-see-inside__slide--active flex flex-col items-center"
                  : "landing-see-inside__slide--idle"
              }`}
              aria-hidden={current !== "access_business"}
            >
            <div className="w-full max-w-[17.5rem] rounded-2xl border border-[#7c3aed]/40 bg-[#140a22] p-3 sm:max-w-sm sm:p-3.5">
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[#a78bfa]">
                How to access
              </p>
              <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-white">
                Pick a Ticket Class
              </h3>
              <div className="mx-auto mt-2 max-w-[160px] overflow-hidden rounded-lg border-2 border-[#a78bfa] shadow-[0_0_20px_rgba(124,58,237,0.4)] ring-2 ring-[#7c3aed]/50 sm:max-w-[180px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/tickets/business-class.jpg"
                  alt="Business Class"
                  className="h-auto w-full object-cover"
                />
              </div>
              <p className="mt-2 text-center text-base font-bold text-white">
                Business Class · $50/mo
              </p>
              <p className="text-center text-[10px] text-emerald-300/90">Selected ✓</p>
            </div>
            </div>

          {/* ── Program Adult ── */}
            <div
              className={`landing-see-inside__slide w-full ${
                current === "pick_adult"
                  ? "landing-see-inside__slide--active flex flex-col items-center"
                  : "landing-see-inside__slide--idle"
              }`}
              aria-hidden={current !== "pick_adult"}
            >
            <div className="w-full max-w-[17.5rem] rounded-2xl border border-white/15 bg-[#12081f] p-3 sm:max-w-sm">
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[#c4b5fd]">
                Program
              </p>
              <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-white">
                Pick a Program
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border-2 border-[#7c3aed] ring-2 ring-[#7c3aed]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PROGRAM_IMAGES.adult}
                  alt="Adult Strength"
                  className="h-28 w-full object-cover sm:h-32"
                />
                <div className="bg-[#1a0b2e] px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-white sm:text-sm">
                    Adult Strength & Conditioning
                  </p>
                  <p className="text-[10px] text-emerald-300">Selected ✓</p>
                </div>
              </div>
            </div>
            </div>

          {/* ── Equipment ── */}
            <div
              className={`landing-see-inside__slide w-full ${
                current === "equip_blank" || current === "equip_all"
                  ? "landing-see-inside__slide--active flex flex-col items-center"
                  : "landing-see-inside__slide--idle"
              }`}
              aria-hidden={current !== "equip_blank" && current !== "equip_all"}
            >
            <div className="w-full max-w-[17.5rem] rounded-2xl border border-white/15 bg-[#12081f] p-3 sm:max-w-sm">
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[#c4b5fd]">
                Gear at home
              </p>
              <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-white">
                {equipSelected ? "Five items selected" : "Your equipment list"}
              </h3>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {DEMO_EQUIPMENT.map((eq) => (
                  <div
                    key={eq.id}
                    className={`overflow-hidden rounded-lg border transition ${
                      equipSelected
                        ? "border-emerald-400/60 ring-1 ring-emerald-400/40"
                        : "border-white/10 opacity-50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={eq.img} alt={eq.name} className="aspect-square w-full object-cover" />
                    {equipSelected ? (
                      <p className="bg-emerald-500/20 text-center text-[8px] font-bold text-emerald-300">
                        ✓
                      </p>
                    ) : (
                      <p className="bg-black/40 py-0.5 text-center text-[8px] text-white/40">—</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-center text-[9px] text-white/45">
                Change anytime in Member → Settings
              </p>
            </div>
            </div>

          {/* ── Book ── */}
            <div
              className={`landing-see-inside__slide w-full ${
                current === "book_open" ||
                current === "book_day" ||
                current === "book_confirm"
                  ? "landing-see-inside__slide--active flex flex-col items-center"
                  : "landing-see-inside__slide--idle"
              }`}
              aria-hidden={
                current !== "book_open" &&
                current !== "book_day" &&
                current !== "book_confirm"
              }
            >
              <div className="w-full max-w-[17.5rem] rounded-2xl border border-emerald-500/30 bg-[#0c1a14] p-3 sm:max-w-sm">
                <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300/90">
                  Book Call
                </p>
                <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-white">
                  Coach Jeremy
                </h3>
                <div className="mt-2 overflow-hidden rounded-xl border border-white/12 bg-[#0a0612]/90">
                  <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed]/30 text-xs font-bold text-[#e9d5ff]">
                      JB
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-white sm:text-sm">
                        Coach Jeremy Byrd
                      </p>
                      <p className="text-[10px] text-emerald-300/90">15-min intro · Calendly</p>
                    </div>
                  </div>
                  {(current === "book_day" || current === "book_confirm") && (
                    <div className="space-y-1 px-2.5 py-2">
                      {BOOK_SLOTS.map((slot, i) => (
                        <div
                          key={slot}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                            i === bookDayIndex
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-white"
                              : "border border-white/8 bg-white/[0.04] text-white/60"
                          }`}
                        >
                          <span className="font-medium">{slot}</span>
                          <span className="text-[9px] font-bold uppercase text-emerald-300">
                            {i === bookDayIndex ? (bookDone ? "Booked ✓" : "Pick →") : "Open"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-white/10 px-2.5 py-2">
                    <div
                      className={`flex h-9 items-center justify-center rounded-full text-xs font-bold ${
                        bookDone
                          ? "bg-emerald-400 text-[#042f1a]"
                          : current === "book_open"
                            ? "bg-emerald-500 text-[#042f1a] ring-2 ring-emerald-300/50"
                            : "bg-emerald-500/80 text-[#042f1a]"
                      }`}
                    >
                      {bookDone
                        ? "Appointment booked ✓"
                        : current === "book_open"
                          ? "Book Call · Coach Jeremy"
                          : "Confirm booking"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : null}
          {/* end stage stack */}

          {/* ── END: exit wizard into normal site nav ── */}
          {phase === "end" && (
            <div className="w-full max-w-lg">
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[#c4b5fd]">
                Your move
              </p>
              <h3 className="mt-0.5 text-center text-xl font-semibold leading-tight text-white sm:text-2xl">
                Where next?
              </h3>
              <p className="mt-0.5 text-center text-[11px] text-white/55">
                Tour ends here — open real tickets or programs on the site.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-2.5">
                {/* Left — ticket art → /join#tickets */}
                <button
                  type="button"
                  onClick={() => exitToSite("/join?from=tour#tickets")}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#7c3aed]/50 bg-[#1a0b2e] text-left shadow-[0_8px_28px_rgba(124,58,237,0.25)] transition hover:border-[#a78bfa]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/tickets/dual-tickets-fan.jpg"
                      alt="Coach Class and First Class tickets"
                      className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a0b2e] via-transparent to-transparent" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c4b5fd] backdrop-blur-sm">
                      Left
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-2 sm:p-2.5">
                    <p className="text-sm font-semibold leading-tight text-white sm:text-base">
                      Choose ticket level
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-white/60">
                      Free · Coach · Business · 1st
                    </p>
                    <span className="mt-1 text-[11px] font-semibold text-[#c4b5fd]">
                      Open levels →
                    </span>
                  </div>
                </button>

                {/* Right — program art → /join#programs */}
                <button
                  type="button"
                  onClick={() => exitToSite("/join?from=tour#programs")}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#12081f] text-left transition hover:border-[#7c3aed]/50"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/programs/choose-program-collage.jpg"
                      alt="Train Station programs — Adult, Athletes, Military, Mom & Dads, Adolescent, Speaking"
                      className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12081f] via-transparent to-transparent" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/60 backdrop-blur-sm">
                      Right
                    </span>
                    <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c4b5fd] backdrop-blur-sm">
                      Programs
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-2 sm:p-2.5">
                    <p className="text-sm font-semibold leading-tight text-white sm:text-base">
                      Choose program
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-white/60">
                      Adult, Athletes, Military…
                    </p>
                    <span className="mt-1 text-[11px] font-semibold text-[#c4b5fd]">
                      Open programs →
                    </span>
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => exitToSite("/join?from=tour#tickets")}
                className="landing-hero-early-signup mt-3 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-extrabold"
              >
                Create Account &amp; Pay
              </button>
              <p className="mt-2 text-center text-[11px] text-white/45">
                Opens real memberships — wizard ends. Start date still needs full onboard.
              </p>
            </div>
          )}

          <p className="max-w-sm text-center text-[12px] font-semibold leading-snug text-white sm:text-[13px]">
            {coachLine}
          </p>
        </div>
      </div>

      {/* Bottom step dots — full tour including final “Where next?” */}
      <div className="flex shrink-0 justify-center gap-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {AUTO_BEATS.map((_, i) => {
          const active = phase === "auto" && i === beat;
          const done = phase === "end" || (phase === "auto" && i < beat);
          return (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                active ? "w-4 bg-white" : done ? "w-2 bg-[#a78bfa]" : "w-1.5 bg-white/25"
              }`}
            />
          );
        })}
        <span
          className={`h-1 rounded-full transition-all ${
            phase === "end" ? "w-4 bg-white" : "w-1.5 bg-white/25"
          }`}
          aria-hidden
        />
      </div>
    </div>,
    document.body
  );
}
