"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FreeTicketModal from "@/components/FreeTicketModal";
import {
  confettiOriginFromElement,
  fireWorkoutConfetti,
} from "@/lib/workout-confetti";
import { TICKET_TIERS, type TicketTierId } from "@/lib/landing-tickets";

/**
 * Cold-traffic “See inside” — few distinct screens only (no near-duplicate slides).
 * Auto-advances every SCREEN_MS until Choose your ticket (last) — user picks Free/Coach/Business/1st.
 * Free opens rickroll modal (product gag).
 */
const BUSINESS_SIGNUP = "/signup?plan=business";
/** ~2 seconds per auto screen (last panel waits for tap) */
const SCREEN_MS = 2000;

const PANELS = [
  { id: "demo", coach: "Live session on your phone — log weight, check sets, finish strong." },
  { id: "signup", coach: "Fast board: Business Class in under a minute." },
  { id: "book", coach: "Book your first appointment with Coach Jeremy." },
  { id: "tickets", coach: "Choose your ticket — Free, Coach, Business, or 1st Class." },
] as const;

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
  const [panel, setPanel] = useState(0);
  const [weight, setWeight] = useState(95);
  const [doneSets, setDoneSets] = useState<number[]>([]);
  const [demoPhase, setDemoPhase] = useState<"idle" | "weight" | "sets" | "done">("idle");
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const lastSetRef = useRef<HTMLButtonElement | null>(null);
  const confettiFired = useRef(false);
  const reducedMotion = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const later = useCallback(
    (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    },
    [],
  );

  const goBusinessSignup = useCallback(() => {
    onClose();
    router.push(BUSINESS_SIGNUP);
  }, [onClose, router]);

  const pickTicket = useCallback(
    (tierId: TicketTierId, signupPlan: string) => {
      if (tierId === "free") {
        setFreeModalOpen(true);
        return;
      }
      onClose();
      router.push(`/signup?plan=${encodeURIComponent(signupPlan)}`);
    },
    [onClose, router],
  );

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPanel(0);
    setWeight(95);
    setDoneSets([]);
    setDemoPhase("idle");
    confettiFired.current = false;
    setFreeModalOpen(false);
    clearTimers();
  }, [open, clearTimers]);

  // Auto-advance 2s/screen until last (tickets) — stay until user picks
  useEffect(() => {
    if (!open) return;
    clearTimers();

    // Demo panel: animate weight/sets/confetti inside the same 2s beat
    if (panel === 0) {
      setWeight(95);
      setDoneSets([]);
      setDemoPhase("idle");
      confettiFired.current = false;
      const fast = reducedMotion.current;
      later(fast ? 200 : 300, () => {
        setDemoPhase("weight");
        setWeight(115);
      });
      later(fast ? 350 : 550, () => setWeight(135));
      later(fast ? 500 : 800, () => {
        setDemoPhase("sets");
        setDoneSets([1]);
      });
      later(fast ? 700 : 1100, () => setDoneSets([1, 2]));
      later(fast ? 900 : 1450, () => {
        setDoneSets([1, 2, 3]);
        setDemoPhase("done");
        if (!confettiFired.current && !fast) {
          confettiFired.current = true;
          const el = lastSetRef.current;
          if (el) fireWorkoutConfetti(confettiOriginFromElement(el));
        }
      });
    }

    // Last panel: choose ticket — do not auto-leave
    if (panel >= PANELS.length - 1) {
      return clearTimers;
    }

    const hold = reducedMotion.current ? 1200 : SCREEN_MS;
    later(hold, () => setPanel((p) => p + 1));
    return clearTimers;
  }, [open, panel, later, clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setPanel((p) => Math.min(p + 1, PANELS.length - 1));
      if (e.key === "ArrowLeft") setPanel((p) => Math.max(p - 1, 0));
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

  const active = PANELS[panel];
  const progress = (panel + 1) / PANELS.length;
  const weightHot = demoPhase !== "idle";
  const setsComplete = doneSets;

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
          <button
            type="button"
            onClick={() => {
              clearTimers();
              setPanel(PANELS.length - 1);
            }}
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

      <div className="mx-4 h-1 shrink-0 overflow-hidden rounded-full bg-white/10 sm:mx-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#f0c75e] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Single stage — fade between distinct panels only */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div
          key={active.id}
          className="landing-see-inside__panel flex w-full max-w-md flex-col items-center gap-4"
        >
          {active.id === "demo" && (
            <>
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
                        const done = setsComplete.includes(n);
                        const isLast = n === 3;
                        return (
                          <button
                            key={n}
                            ref={isLast ? lastSetRef : undefined}
                            type="button"
                            tabIndex={-1}
                            className={`flex h-12 flex-1 flex-col items-center justify-center rounded-lg border text-xs font-bold transition-colors duration-300 ${
                              done
                                ? "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                                : "border-white/15 bg-white/5 text-white/80"
                            }`}
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
                    <p className="mt-2 min-h-[1rem] text-[10px] font-medium text-[#c4b5fd]/90">
                      {demoPhase === "idle" && "Coach Jeremy is on the floor with you."}
                      {demoPhase === "weight" && "Weight updated · coach sees it live"}
                      {demoPhase === "sets" && `${setsComplete.length}/3 sets logged`}
                      {demoPhase === "done" && "Exercise complete — nice work"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 opacity-55">
                    <p className="text-[11px] font-semibold text-white/70">Next · Push-up</p>
                    <p className="text-[10px] text-white/40">3 × 10 · Bodyweight</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {active.id === "signup" && (
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
              <h3 className="mt-3 text-center text-xl font-semibold text-white">Business Class</h3>
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
            </div>
          )}

          {active.id === "book" && (
            <div className="w-full max-w-sm rounded-3xl border border-emerald-500/30 bg-[#0c1a14] p-5 shadow-[0_20px_60px_rgba(16,185,129,0.15)]">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/90">
                After you board
              </p>
              <h3 className="mt-2 text-center text-xl font-semibold text-white">
                Book with Coach Jeremy
              </h3>
              <p className="mt-1 text-center text-[12px] text-white/55">
                First appointment — intro call, start date, your plan
              </p>

              {/* Mock Book Call card — matches member app path */}
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
                <div className="space-y-1.5 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Next open slots
                  </p>
                  {["Tue · 11:00 AM", "Tue · 1:00 PM", "Wed · 2:45 PM"].map((slot, i) => (
                    <div
                      key={slot}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] ${
                        i === 0
                          ? "border border-emerald-400/40 bg-emerald-500/15 text-white"
                          : "border border-white/8 bg-white/[0.04] text-white/70"
                      }`}
                    >
                      <span className="font-medium">{slot}</span>
                      <span
                        className={
                          i === 0
                            ? "text-[10px] font-bold uppercase text-emerald-300"
                            : "text-[10px] text-white/35"
                        }
                      >
                        {i === 0 ? "Pick →" : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 px-3 py-2.5">
                  <div className="flex h-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-[#042f1a]">
                    Book Call · Coach Jeremy
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-[11px] leading-snug text-white/55">
                In the app: <span className="font-semibold text-emerald-300">Book Call</span> in the
                bottom nav — opens Jeremy&apos;s calendar.
              </p>
            </div>
          )}

          {active.id === "tickets" && (
            <div className="w-full max-w-md">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4b5fd]">
                Your level
              </p>
              <h3 className="mt-1 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Choose your ticket
              </h3>
              <p className="mt-1 text-center text-[12px] text-white/55">
                Free · Coach · Business · 1st Class
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-2.5">
                {TICKET_TIERS.map((tier) => {
                  const isFree = tier.id === "free";
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => pickTicket(tier.id, tier.signupPlan)}
                      className={`group relative flex min-h-[148px] flex-col overflow-hidden rounded-xl border text-left shadow-lg transition active:scale-[0.98] sm:min-h-[160px] ${tier.themeClass}`}
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
                      <div className="relative z-10 mt-auto flex flex-col p-2.5 sm:p-3">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
                          {tier.subtitle}
                        </span>
                        <span className="text-sm font-bold text-white sm:text-base">
                          {tier.title}
                        </span>
                        <span className="mt-0.5 text-lg font-semibold text-white">
                          {tier.price}
                          {tier.priceNote ? (
                            <span className="ml-0.5 text-[10px] font-medium text-white/60">
                              {tier.priceNote}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 text-[10px] font-semibold text-[#c4b5fd] group-hover:text-white">
                          {isFree ? "Tap if you dare →" : "Select →"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="landing-see-inside__coach max-w-sm text-center text-[15px] font-semibold leading-snug text-white sm:text-base">
            {active.coach}
          </p>
        </div>
      </div>

      <div
        className="flex shrink-0 justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
        aria-hidden
      >
        {PANELS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === panel ? "w-6 bg-white" : i < panel ? "w-3 bg-[#a78bfa]" : "w-2 bg-white/25"
            }`}
            onClick={() => {
              clearTimers();
              setPanel(i);
            }}
            aria-label={`Go to ${p.id}`}
          />
        ))}
      </div>

      <FreeTicketModal
        open={freeModalOpen}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        welcomeVideoUrl={welcomeVideoUrl}
        purchaseAuth={{ signedIn: false }}
        onClose={() => setFreeModalOpen(false)}
        onUpgrade={() => {
          setFreeModalOpen(false);
          // Stay on tickets so they can pick Coach / Business / 1st
        }}
      />
    </div>
  );
}
