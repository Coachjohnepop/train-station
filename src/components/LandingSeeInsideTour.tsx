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
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

/**
 * See inside — full auto-play, left/right arrows, then two real choices.
 *
 * Auto: workout ×5 → Business → Adult → equip blank/all → book open/day/confirm
 * Confetti + post-confetti steps hold longer (felt rushed).
 */
const STEP_MS = 2000;
/** Confetti beat: let the burst play before advancing */
const CONFETTI_HOLD_MS = 3600;
/** After confetti (access, program, gear, book) — slower so it doesn’t blur past */
const AFTER_CONFETTI_MS = 3200;

type AutoBeat =
  | "w_weight"
  | "w_set1"
  | "w_set2"
  | "w_set3"
  | "w_confetti"
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
  "w_confetti",
  "access_business",
  "pick_adult",
  "equip_blank",
  "equip_all",
  "book_open",
  "book_day",
  "book_confirm",
];

type EndMode = "choice" | "tickets" | "programs" | "pay";

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
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
}: {
  open: boolean;
  onClose: () => void;
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
}) {
  const router = useRouter();
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState<"auto" | "end">("auto");
  const [endMode, setEndMode] = useState<EndMode>("choice");
  const [plan, setPlan] = useState("business");
  const [programSlug, setProgramSlug] = useState<string | null>("adult");
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const lastSetRef = useRef<HTMLDivElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);
  const timers = useRef<number[]>([]);
  const paused = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const goPay = useCallback(() => {
    const q = new URLSearchParams({ plan });
    if (programSlug) q.set("interest", programSlug);
    onClose();
    router.push(`/signup?${q.toString()}`);
  }, [onClose, plan, programSlug, router]);

  // Reset
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paused.current = false;
    setPhase("auto");
    setBeat(0);
    setEndMode("choice");
    setPlan("business");
    setProgramSlug("adult");
    setFreeModalOpen(false);
    confettiFired.current = false;
    clearTimers();
  }, [open, clearTimers]);

  function holdMsForBeat(index: number): number {
    if (reducedMotion.current) return 1000;
    const id = AUTO_BEATS[index];
    if (id === "w_confetti") return CONFETTI_HOLD_MS;
    // Everything after confetti was flying by — give it more air
    const confettiIdx = AUTO_BEATS.indexOf("w_confetti");
    if (index > confettiIdx) return AFTER_CONFETTI_MS;
    return STEP_MS;
  }

  const goPrev = useCallback(() => {
    paused.current = true;
    clearTimers();
    if (phase === "end") {
      if (endMode === "tickets" || endMode === "programs" || endMode === "pay") {
        setEndMode("choice");
        return;
      }
      // From final choices back into auto sequence at last beat
      setPhase("auto");
      setBeat(AUTO_BEATS.length - 1);
      return;
    }
    if (beat <= 0) return;
    setBeat((b) => b - 1);
  }, [phase, endMode, beat, clearTimers]);

  const goNext = useCallback(() => {
    paused.current = true;
    clearTimers();
    if (phase === "end") {
      if (endMode === "choice") {
        // Stay on choices — no forced advance
        return;
      }
      return;
    }
    if (beat >= AUTO_BEATS.length - 1) {
      setPhase("end");
      setEndMode("choice");
      return;
    }
    setBeat((b) => b + 1);
  }, [phase, endMode, beat, clearTimers]);

  // Auto-advance (paused after manual arrow)
  useEffect(() => {
    if (!open || phase !== "auto" || paused.current) return;
    clearTimers();
    const ms = holdMsForBeat(beat);
    const id = window.setTimeout(() => {
      if (paused.current) return;
      if (beat >= AUTO_BEATS.length - 1) {
        setPhase("end");
        setEndMode("choice");
        return;
      }
      setBeat((b) => b + 1);
    }, ms);
    timers.current.push(id);
    return clearTimers;
  }, [open, phase, beat, clearTimers]);

  // Confetti ONLY on its own beat — after set 3 has already been held for a full step
  useEffect(() => {
    if (!open || phase !== "auto") return;
    const step = AUTO_BEATS[beat];
    // Never fire on set-check beats (especially w_set3)
    if (step !== "w_confetti") return;
    if (confettiFired.current || reducedMotion.current) return;
    confettiFired.current = true;
    // Slight delay so set-3 checkmark is already settled from previous step
    const t = window.setTimeout(() => {
      const el = lastSetRef.current;
      if (el) {
        fireWorkoutConfetti(confettiOriginFromElement(el), 1800);
      } else {
        fireWorkoutConfetti(undefined, 1800);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, phase, beat]);

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

  if (!open) return null;

  const current = phase === "auto" ? AUTO_BEATS[beat] : null;
  const progress =
    phase === "auto"
      ? ((beat + 1) / (AUTO_BEATS.length + 1)) * 100
      : 100;

  const displayWeight =
    current === "w_weight" ||
    current === "w_set1" ||
    current === "w_set2" ||
    current === "w_set3" ||
    current === "w_confetti"
      ? 135
      : 95;

  // Set 3 checks alone on w_set3; confetti beat keeps them checked (no re-toggle)
  const doneSets =
    current === "w_set1"
      ? [1]
      : current === "w_set2"
        ? [1, 2]
        : current === "w_set3" || current === "w_confetti"
          ? [1, 2, 3]
          : [];
  const set3JustDone = current === "w_set3";
  const celebrating = current === "w_confetti";

  const equipSelected = current === "equip_all";
  const bookDayIndex =
    current === "book_day" || current === "book_confirm" ? 0 : -1;
  const bookDone = current === "book_confirm";

  const planLabel = signupPlanLabel(normalizeSignupPlan(plan));
  const isPaid = normalizeSignupPlan(plan) !== "explorer";

  const programs = TOP_LEVEL_PROGRAMS.filter((p) => p.catalogStatus !== "hidden");
  // Prefer six tiles: catalog + fill from PROGRAM_IMAGES keys if needed
  const programTiles = [
    ...programs.map((p) => ({
      slug: p.slug,
      name: p.name,
      img: PROGRAM_IMAGES[p.slug] || "/images/programs/adult.jpg",
    })),
  ];
  while (programTiles.length < 6) {
    const extras = [
      { slug: "chest", name: "Upper strength", img: "/images/programs/chest-press.jpg" },
      { slug: "squat", name: "Lower power", img: "/images/programs/squat.jpg" },
    ];
    const e = extras[programTiles.length - programs.length];
    if (!e) break;
    programTiles.push(e);
  }

  const coachLine =
    phase === "end"
      ? endMode === "choice"
        ? "Choose ticket level (left) or a program (right). Pay anytime — program is optional."
        : endMode === "tickets"
          ? "Pick your level. Seat art shows the class you board."
          : endMode === "programs"
            ? "Pick a track — or skip and go straight to payment."
            : "Checkout whenever you’re ready. Change anything later in Member → Settings."
      : current === "w_weight"
        ? "Log the weight you used."
        : current === "w_set1"
          ? "Set 1 complete."
          : current === "w_set2"
            ? "Set 2 complete."
            : current === "w_set3"
              ? "Set 3 complete."
              : current === "w_confetti"
                ? "Finish — confetti."
            : current === "access_business"
              ? "How to access — Business Class (demo)."
              : current === "pick_adult"
                ? "Pick your program — Adult Strength."
                : current === "equip_blank"
                  ? "Your gear list starts empty."
                  : current === "equip_all"
                    ? "Tap what you have at home — five items selected."
                    : current === "book_open"
                      ? "Book Call with Coach Jeremy."
                      : current === "book_day"
                        ? "Pick an open day and time."
                        : "Booked — intro call locked in.";

  function pickTicket(tierId: TicketTierId, signupPlan: string) {
    if (tierId === "free") {
      setPlan("explorer");
      setFreeModalOpen(true);
      return;
    }
    setPlan(signupPlan);
    setEndMode("pay");
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
            Station tour
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {phase === "auto" ? (
            <button
              type="button"
              onClick={() => {
                paused.current = true;
                clearTimers();
                setPhase("end");
                setEndMode("choice");
              }}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85"
            >
              Skip to choices
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mx-4 h-1 shrink-0 overflow-hidden rounded-full bg-white/10 sm:mx-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(progress)}%` }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {/* Left / right nav */}
        <button
          type="button"
          onClick={goPrev}
          disabled={phase === "auto" && beat === 0}
          className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-xl font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-25 sm:left-4"
          aria-label="Previous step"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-xl font-bold text-white shadow-lg backdrop-blur-sm transition hover:bg-white/15 sm:right-4"
          aria-label="Next step"
        >
          ›
        </button>

        <div className="landing-see-inside__panel flex w-full max-w-md flex-col items-center gap-3 px-10 sm:px-12">
          {/* ── Workout phone ── */}
          {phase === "auto" && current?.startsWith("w_") && (
            <div className="w-full max-w-[300px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#12081f] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
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
              <div className="p-3.5">
                <div className="rounded-xl border border-[#7c3aed]/35 bg-[#1a0b2e]/90 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-[#c4b5fd]/80">Now</p>
                      <h3 className="text-base font-semibold text-white">Goblet squat</h3>
                      <p className="mt-0.5 text-[11px] text-white/55">3 × 8 · Medium</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-[#fde68a]">
                      {displayWeight}
                      <span className="ml-0.5 text-[10px] text-white/45">lbs</span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <label className="flex min-w-[4.25rem] flex-col rounded-lg border border-white/15 bg-black/30 px-2 py-1.5">
                      <span className="text-[8px] font-bold uppercase text-white/40">Weight</span>
                      <span className="text-lg font-bold tabular-nums text-[#fde68a]">
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
                          className={`flex h-12 flex-1 flex-col items-center justify-center rounded-lg border text-xs font-bold transition-colors duration-500 ${
                            done
                              ? isThird && set3JustDone
                                ? "border-[#c4b5fd]/70 bg-[#7c3aed]/25 text-[#e9d5ff]"
                                : celebrating && isThird
                                  ? "border-[#d4af37]/70 bg-[#d4af37]/30 text-[#fde68a] scale-105"
                                  : "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                              : "border-white/15 bg-white/5 text-white/80"
                          }`}
                        >
                          <span className="text-base leading-none">{done ? "✓" : n}</span>
                          <span className="text-[8px] uppercase opacity-70">Set</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── How to Access · Business Class ── */}
          {phase === "auto" && current === "access_business" && (
            <div className="w-full max-w-sm rounded-3xl border border-[#7c3aed]/40 bg-[#140a22] p-5">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#a78bfa]">
                How to access
              </p>
              <h3 className="mt-1 text-center text-xl font-semibold text-white">
                Pick Business Class
              </h3>
              <div className="mx-auto mt-3 max-w-[200px] overflow-hidden rounded-xl border-2 border-[#a78bfa] shadow-[0_0_24px_rgba(124,58,237,0.45)] ring-2 ring-[#7c3aed]/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/tickets/business-class.jpg"
                  alt="Business Class"
                  className="h-auto w-full object-cover"
                />
              </div>
              <p className="mt-3 text-center text-lg font-bold text-white">
                Business Class · $50/mo
              </p>
              <p className="mt-1 text-center text-[11px] text-emerald-300/90">Selected ✓</p>
            </div>
          )}

          {/* ── Program Adult ── */}
          {phase === "auto" && current === "pick_adult" && (
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#12081f] p-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Program
              </p>
              <h3 className="mt-1 text-center text-xl font-semibold text-white">Pick Adult</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border-2 border-[#7c3aed] ring-2 ring-[#7c3aed]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PROGRAM_IMAGES.adult}
                  alt="Adult Strength"
                  className="h-36 w-full object-cover"
                />
                <div className="bg-[#1a0b2e] px-3 py-2">
                  <p className="text-sm font-semibold text-white">Adult Strength Conditioning</p>
                  <p className="text-[11px] text-emerald-300">Selected ✓</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Equipment ── */}
          {phase === "auto" && (current === "equip_blank" || current === "equip_all") && (
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#12081f] p-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Gear at home
              </p>
              <h3 className="mt-1 text-center text-lg font-semibold text-white">
                {equipSelected ? "Five items selected" : "Your equipment list"}
              </h3>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
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
              <p className="mt-2 text-center text-[10px] text-white/45">
                Change anytime in Member → Settings
              </p>
            </div>
          )}

          {/* ── Book ── */}
          {phase === "auto" &&
            (current === "book_open" || current === "book_day" || current === "book_confirm") && (
              <div className="w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-[#0c1a14] p-4">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/90">
                  Book Call
                </p>
                <h3 className="mt-1 text-center text-lg font-semibold text-white">
                  Coach Jeremy
                </h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/12 bg-[#0a0612]/90">
                  <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7c3aed]/30 text-sm font-bold text-[#e9d5ff]">
                      JB
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">Coach Jeremy Byrd</p>
                      <p className="text-[11px] text-emerald-300/90">15-min intro · Calendly</p>
                    </div>
                  </div>
                  {(current === "book_day" || current === "book_confirm") && (
                    <div className="space-y-1.5 px-3 py-2.5">
                      {BOOK_SLOTS.map((slot, i) => (
                        <div
                          key={slot}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-[12px] ${
                            i === bookDayIndex
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-white"
                              : "border border-white/8 bg-white/[0.04] text-white/60"
                          }`}
                        >
                          <span className="font-medium">{slot}</span>
                          <span className="text-[10px] font-bold uppercase text-emerald-300">
                            {i === bookDayIndex ? (bookDone ? "Booked ✓" : "Pick →") : "Open"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-white/10 px-3 py-2.5">
                    <div
                      className={`flex h-10 items-center justify-center rounded-full text-sm font-bold ${
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
            )}

          {/* ── END: two real choices ── */}
          {phase === "end" && endMode === "choice" && (
            <div className="w-full max-w-md">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Your move
              </p>
              <h3 className="mt-1 text-center text-2xl font-semibold text-white">
                Where next?
              </h3>
              <p className="mt-1 text-center text-[12px] text-white/55">
                Ticket or program first — both reach payment. Program is optional.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEndMode("tickets")}
                  className="flex min-h-[150px] flex-col items-start justify-between rounded-2xl border border-[#7c3aed]/50 bg-[#1a0b2e] p-4 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#a78bfa]">
                    Left
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Choose ticket level</p>
                    <p className="mt-1 text-[12px] text-white/60">
                      Free · Coach · Business · 1st — seat art for each class.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#c4b5fd]">Open levels →</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEndMode("programs")}
                  className="flex min-h-[150px] flex-col items-start justify-between rounded-2xl border border-white/15 bg-[#12081f] p-4 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                    Right
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-white">Choose program</p>
                    <p className="mt-1 text-[12px] text-white/60">
                      Adult, Athletes, Military… with program art.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#c4b5fd]">Open programs →</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEndMode("pay")}
                className="mt-3 w-full text-center text-xs font-semibold text-white/50 underline decoration-white/25 underline-offset-4"
              >
                Skip program — go to payment →
              </button>
            </div>
          )}

          {phase === "end" && endMode === "tickets" && (
            <div className="w-full max-w-md">
              <button
                type="button"
                onClick={() => setEndMode("choice")}
                className="mb-2 text-[11px] font-semibold text-white/50"
              >
                ← Back
              </button>
              <h3 className="text-center text-xl font-semibold text-white">Choose ticket level</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {TICKET_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => pickTicket(tier.id, tier.signupPlan)}
                    className={`relative flex min-h-[140px] flex-col overflow-hidden rounded-xl border text-left ${tier.themeClass}`}
                  >
                    {tier.seatArtSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tier.seatArtSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-90"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-transparent" />
                    <div className="relative z-10 mt-auto p-2.5">
                      <p className="text-sm font-bold text-white">{tier.title}</p>
                      <p className="text-lg font-semibold text-white">
                        {tier.price}
                        {tier.priceNote ? (
                          <span className="text-[10px] text-white/60">{tier.priceNote}</span>
                        ) : null}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "end" && endMode === "programs" && (
            <div className="w-full max-w-md">
              <button
                type="button"
                onClick={() => setEndMode("choice")}
                className="mb-2 text-[11px] font-semibold text-white/50"
              >
                ← Back
              </button>
              <h3 className="text-center text-xl font-semibold text-white">Choose program</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {programTiles.slice(0, 6).map((p) => {
                  const active = programSlug === p.slug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setProgramSlug(p.slug)}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        active
                          ? "border-[#7c3aed] ring-2 ring-[#7c3aed]/50"
                          : "border-white/12"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.img} alt="" className="aspect-[4/3] w-full object-cover" />
                      <p className="bg-[#12081f] px-1.5 py-1 text-[10px] font-semibold leading-tight text-white">
                        {p.name}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEndMode("pay")}
                  disabled={!programSlug}
                  className="landing-hero-early-signup inline-flex h-12 items-center justify-center rounded-full text-[15px] font-extrabold disabled:opacity-40"
                >
                  Continue to payment →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProgramSlug(null);
                    setEndMode("pay");
                  }}
                  className="text-xs font-semibold text-white/50 underline"
                >
                  Skip program — pay only →
                </button>
              </div>
            </div>
          )}

          {phase === "end" && endMode === "pay" && (
            <div className="w-full max-w-sm rounded-3xl border border-[#7c3aed]/40 bg-[#140a22] p-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#a78bfa]">
                Payment
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{planLabel}</h3>
              {programSlug ? (
                <p className="mt-1 text-sm text-white/60">
                  Program:{" "}
                  {programTiles.find((p) => p.slug === programSlug)?.name || programSlug}
                </p>
              ) : (
                <p className="mt-1 text-sm text-white/50">No program yet — pick later in Settings</p>
              )}
              <p className="mt-3 text-[11px] text-white/45">
                Pay now. Start date still needs full onboard. Everything editable in{" "}
                <strong className="text-white/70">Member → Settings</strong>.
              </p>
              <button
                type="button"
                onClick={goPay}
                className="landing-hero-early-signup mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-extrabold"
              >
                {isPaid ? `Pay & create account · ${planLabel} →` : `Create Free account →`}
              </button>
              <button
                type="button"
                onClick={() => setEndMode("choice")}
                className="mt-2 text-xs text-white/45"
              >
                ← Change ticket or program
              </button>
            </div>
          )}

          <p className="max-w-sm text-center text-[14px] font-semibold leading-snug text-white sm:text-[15px]">
            {coachLine}
          </p>
        </div>
      </div>

      {phase === "auto" ? (
        <div className="flex shrink-0 justify-center gap-1 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1">
          {AUTO_BEATS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === beat ? "w-4 bg-white" : i < beat ? "w-2 bg-[#a78bfa]" : "w-1.5 bg-white/25"
              }`}
            />
          ))}
        </div>
      ) : null}

      <FreeTicketModal
        open={freeModalOpen}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        welcomeVideoUrl={welcomeVideoUrl}
        purchaseAuth={{ signedIn: false }}
        onClose={() => setFreeModalOpen(false)}
        onUpgrade={() => setFreeModalOpen(false)}
        onContinueFree={() => {
          setPlan("explorer");
          setEndMode("pay");
        }}
      />
    </div>
  );
}
