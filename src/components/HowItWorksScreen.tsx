"use client";

import type { Ref } from "react";
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import type { HowItWorksStepId } from "@/lib/how-it-works";

const DEMO_EQUIPMENT = [
  { id: "dumbbells", name: "Dumbbells", img: "/images/equipment/dumbbells.jpg" },
  { id: "kettlebell", name: "Kettlebell", img: "/images/equipment/kettlebell.jpg" },
  { id: "bands", name: "Resistance bands", img: "/images/equipment/resistance-bands.jpg" },
  { id: "bench", name: "Bench", img: "/images/equipment/bench.jpg" },
  { id: "mat", name: "Yoga mat", img: "/images/equipment/yoga-mat.jpg" },
];

const BOOK_SLOTS = ["Tue · 11:00 AM", "Tue · 1:00 PM", "Wed · 2:45 PM"];

/** Same picture guests see on How it Works — used in the tour and in Admin. */
export default function HowItWorksScreen({
  stepId,
  lastSetRef,
}: {
  stepId: HowItWorksStepId;
  lastSetRef?: Ref<HTMLDivElement>;
}) {
  if (stepId === "workout") {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-[#12081f] shadow-[0_16px_48px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent-fg)]">
              Live session
            </p>
            <p className="text-base font-semibold leading-tight text-[var(--text)]">
              Today · Lower day
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            LIVE
          </span>
        </div>
        <div className="p-2.5">
          <div className="rounded-lg border border-[#7c3aed]/35 bg-[#1a0b2e]/90 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase text-[var(--accent-fg)]/80">Now</p>
                <h3 className="text-lg font-semibold leading-tight text-[var(--text)]">
                  Goblet squat
                </h3>
                <p className="text-xs text-white/70">3 × 8 · Medium</p>
              </div>
              <span className="text-xs font-bold tabular-nums text-[#fde68a]">
                135
                <span className="ml-0.5 text-[9px] text-white/45">lbs</span>
              </span>
            </div>
            <div className="mt-2 flex items-end gap-1.5">
              <label className="flex min-w-[3.75rem] flex-col rounded-md border border-white/15 bg-black/30 px-1.5 py-1">
                <span className="text-[7px] font-bold uppercase text-white/40">Weight</span>
                <span className="text-base font-bold tabular-nums leading-none text-[#fde68a]">
                  135
                </span>
              </label>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  ref={n === 3 ? lastSetRef : undefined}
                  className={`flex h-12 flex-1 flex-col items-center justify-center rounded-md border text-sm font-bold ${
                    n === 3
                      ? "border-[#d4af37]/70 bg-[#d4af37]/30 text-[#fde68a]"
                      : "border-[#d4af37]/55 bg-[#d4af37]/20 text-[#fde68a]"
                  }`}
                >
                  <span className="text-sm leading-none">✓</span>
                  <span className="text-[7px] uppercase opacity-70">Set</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "ticket") {
    return (
      <div className="w-full rounded-2xl border border-[#7c3aed]/40 bg-[var(--surface)] p-4">
        <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
          How to access
        </p>
        <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-[var(--text)]">
          Pick a Ticket Class
        </h3>
        <div className="mx-auto mt-2 w-[min(100%,220px)] overflow-hidden rounded-lg border-2 border-[#a78bfa] shadow-[0_0_20px_rgba(124,58,237,0.4)] ring-2 ring-[#7c3aed]/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tickets/business-class.jpg"
            alt="Business Class"
            className="h-auto w-full object-cover"
          />
        </div>
        <p className="mt-2 text-center text-base font-bold text-[var(--text)]">
          Business Class · $50/mo
        </p>
        <p className="text-center text-[10px] text-emerald-300/90">Selected ✓</p>
      </div>
    );
  }

  if (stepId === "program") {
    return (
      <div className="w-full rounded-2xl border border-white/15 bg-[#12081f] p-4">
        <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
          Program
        </p>
        <h3 className="mt-0.5 text-center text-lg font-semibold leading-tight text-[var(--text)]">
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
            <p className="text-xs font-semibold text-[var(--text)] sm:text-sm">
              Adult Strength & Conditioning
            </p>
            <p className="text-[10px] text-emerald-300">Selected ✓</p>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "gear") {
    return (
      <div className="w-full rounded-2xl border border-white/15 bg-[#12081f] p-4">
        <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--accent-fg)]">
          Gear at home
        </p>
        <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-[var(--text)]">
          Five items selected
        </h3>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {DEMO_EQUIPMENT.map((eq) => (
            <div
              key={eq.id}
              className="overflow-hidden rounded-lg border border-emerald-400/60 ring-1 ring-emerald-400/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eq.img} alt={eq.name} className="aspect-square w-full object-cover" />
              <p className="bg-emerald-500/20 text-center text-[8px] font-bold text-emerald-300">
                ✓
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[9px] text-white/45">
          Change anytime in Member → Settings
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-emerald-500/30 bg-[#0c1a14] p-4">
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-300/90">
        Book Call
      </p>
      <h3 className="mt-0.5 text-center text-base font-semibold leading-tight text-[var(--text)]">
        Coach Jeremy
      </h3>
      <div className="mt-2 overflow-hidden rounded-xl border border-white/12 bg-[var(--bg)]/90">
        <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed]/30 text-xs font-bold text-[#e9d5ff]">
            JB
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text)] sm:text-base">
              Coach Jeremy Byrd
            </p>
            <p className="text-[10px] text-emerald-300/90">15-min intro · Calendly</p>
          </div>
        </div>
        <div className="space-y-1 px-2.5 py-2">
          {BOOK_SLOTS.map((slot, i) => (
            <div
              key={slot}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                i === 0
                  ? "border border-emerald-400/50 bg-emerald-500/20 text-white"
                  : "border border-white/8 bg-white/[0.04] text-white/60"
              }`}
            >
              <span className="font-medium">{slot}</span>
              <span className="text-[9px] font-bold uppercase text-emerald-300">
                {i === 0 ? "Booked ✓" : "Open"}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-2.5 py-2">
          <div className="flex h-9 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-[#042f1a]">
            Appointment booked ✓
          </div>
        </div>
      </div>
    </div>
  );
}
