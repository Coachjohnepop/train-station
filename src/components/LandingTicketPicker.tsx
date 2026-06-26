"use client";

import Link from "next/link";
import { useState } from "react";
import FreeTicketModal from "@/components/FreeTicketModal";
import TrainStationBrand from "@/components/TrainStationBrand";
import { TICKET_TIERS, type TicketTierId } from "@/lib/landing-tickets";

export default function LandingTicketPicker({
  freeChastiseVideoUrl = null,
}: {
  freeChastiseVideoUrl?: string | null;
}) {
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const [highlightPaid, setHighlightPaid] = useState(false);

  function handleTicketClick(tierId: TicketTierId) {
    if (tierId === "free") {
      setFreeModalOpen(true);
      return;
    }
    const tier = TICKET_TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    window.location.href = `/signup?plan=${encodeURIComponent(tier.signupPlan)}`;
  }

  function scrollToTickets() {
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section id="tickets" className="scroll-mt-4 bg-[#0a0612] px-3 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl text-center">
        <TrainStationBrand variant="compact" className="mb-6" />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">Pick your ticket</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Membership tickets
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#9d8ab8]">
          Tap a ticket on your phone — side by side, no guessing. We&apos;ll guide you through setup after you choose.
        </p>
      </div>

      <div
        className={`mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3 transition-all ${
          highlightPaid ? "ring-2 ring-[#7c3aed]/40 rounded-2xl p-2" : ""
        }`}
      >
        {TICKET_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => handleTicketClick(tier.id)}
            className={`group relative flex min-h-[200px] flex-col rounded-xl border bg-gradient-to-b p-2.5 text-left shadow-lg transition-all active:scale-[0.97] sm:min-h-[240px] sm:rounded-2xl sm:p-4 ${tier.accent} ${
              tier.id !== "free" && highlightPaid ? "scale-[1.02] shadow-[#7c3aed]/20" : "hover:scale-[1.02]"
            }`}
          >
            <div className="pointer-events-none absolute right-2 top-2 h-3 w-3 rounded-full border border-dashed border-white/20 sm:right-3 sm:top-3 sm:h-4 sm:w-4" />
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 sm:text-[10px]">
              {tier.subtitle}
            </div>
            <div className="mt-1 text-sm font-bold leading-tight text-white sm:text-lg">{tier.title}</div>
            <div className="mt-2 flex items-baseline gap-0.5">
              <span className="text-xl font-semibold text-white sm:text-3xl">{tier.price}</span>
              {tier.priceNote && (
                <span className="text-[10px] text-white/60 sm:text-xs">{tier.priceNote}</span>
              )}
            </div>
            <ul className="mt-3 flex-1 space-y-1">
              {tier.perks.map((p) => (
                <li key={p} className="text-[9px] leading-snug text-white/75 sm:text-xs">
                  · {p}
                </li>
              ))}
            </ul>
            <span className="mt-3 inline-block text-[10px] font-semibold text-[#c4b5fd] group-hover:text-white sm:text-xs">
              {tier.id === "free" ? "Tap if you dare →" : "Select →"}
            </span>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/join/questions"
          className="text-sm font-medium text-[#7c3aed] hover:text-[#a78bfa] hover:underline"
        >
          Not sure? 1-minute assessment →
        </Link>
        <span className="hidden text-[#3d2660] sm:inline">·</span>
        <Link href="/login" className="text-sm text-[#9d8ab8] hover:text-white">
          Already have access? Sign in
        </Link>
      </div>

      <FreeTicketModal
        open={freeModalOpen}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        onClose={() => setFreeModalOpen(false)}
        onUpgrade={() => {
          setHighlightPaid(true);
          scrollToTickets();
          setTimeout(() => setHighlightPaid(false), 4000);
        }}
      />
    </section>
  );
}