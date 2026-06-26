"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FreeTicketModal from "@/components/FreeTicketModal";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import TrainStationBrand from "@/components/TrainStationBrand";
import {
  TICKET_TIERS,
  mergeTicketPrices,
  type TicketTier,
  type TicketTierId,
} from "@/lib/landing-tickets";

export default function LandingTicketPicker({
  freeChastiseVideoUrl = null,
}: {
  freeChastiseVideoUrl?: string | null;
}) {
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const [highlightPaid, setHighlightPaid] = useState(false);
  const [tiers, setTiers] = useState<TicketTier[]>(TICKET_TIERS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/pricing/public");
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !Array.isArray(body.tickets)) return;
        setTiers(mergeTicketPrices(body.tickets));
      } catch {
        // Keep static fallback tiers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleTicketClick(tierId: TicketTierId) {
    if (tierId === "free") {
      setFreeModalOpen(true);
      return;
    }
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) return;
    window.location.href = `/signup?plan=${encodeURIComponent(tier.signupPlan)}`;
  }

  function scrollToTickets() {
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section id="tickets" className="scroll-mt-20 bg-[var(--bg)] px-3 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl text-center">
        <TrainStationBrand variant="compact" className="mb-6" />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent)]">Pick your ticket</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
          Membership tickets
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          Tap a ticket on your phone — side by side, no guessing. We&apos;ll guide you through setup after you choose.
        </p>
      </div>

      <div
        className={`mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 transition-all ${
          highlightPaid ? "ring-2 ring-[var(--tier-trim-strong)]/40 rounded-2xl p-2" : ""
        }`}
      >
        {tiers.map((tier) => (
          <button
            key={tier.id}
            id={`ticket-${tier.id}`}
            type="button"
            onClick={() => handleTicketClick(tier.id)}
            className={`group relative flex min-h-[200px] flex-col rounded-xl border text-left shadow-lg transition-all active:scale-[0.97] sm:min-h-[280px] sm:rounded-2xl ${tier.themeClass} ${
              tier.id !== "free" && highlightPaid ? "scale-[1.02] shadow-[var(--tier-trim-glow)]" : "hover:scale-[1.02]"
            }`}
          >
            {tier.seatArtSrc ? (
              <MembershipSeatArt ticketId={tier.id} className="ticket-card__art" />
            ) : (
              <div className="ticket-card__art bg-gradient-to-br from-zinc-700/40 to-zinc-900/60" />
            )}
            <div className="ticket-card__body relative">
              <div className="pointer-events-none absolute right-0 top-0 h-3 w-3 rounded-full border border-dashed border-white/20 sm:h-4 sm:w-4" />
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
              <ul className="mt-2 flex-1 space-y-0.5">
                {tier.perks.slice(0, 3).map((p) => (
                  <li key={p} className="text-[9px] leading-snug text-white/75 sm:text-xs">
                    · {p}
                  </li>
                ))}
              </ul>
              <span className="mt-2 inline-block text-[10px] font-semibold text-[#c4b5fd] group-hover:text-white sm:text-xs">
                {tier.id === "free" ? "Tap if you dare →" : "Select →"}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/join/questions"
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline"
        >
          Not sure? 1-minute assessment →
        </Link>
        <span className="hidden text-[#3d2660] sm:inline">·</span>
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
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