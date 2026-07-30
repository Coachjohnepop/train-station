"use client";

import Link from "next/link";
import { useState } from "react";
import FreeTicketModal from "@/components/FreeTicketModal";
import MembershipTicketGrid from "@/components/MembershipTicketGrid";
import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import type { FreeTicketGagConfig } from "@/lib/landing-media";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import type { TicketTierId } from "@/lib/landing-tickets";
import { TICKET_TIERS } from "@/lib/landing-tickets";

export default function LandingTicketPicker({
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  gagConfig = null,
  purchaseAuth: purchaseAuthProp,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  gagConfig?: Partial<FreeTicketGagConfig> | null;
  purchaseAuth?: PurchaseAuth;
}) {
  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const [highlightPaid, setHighlightPaid] = useState(false);
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);

  function handleTicketClick(tierId: TicketTierId) {
    if (tierId === "free") {
      setFreeModalOpen(true);
      return;
    }
    const tier = TICKET_TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    window.location.href = purchaseHref(tier.signupPlan, purchaseAuth);
  }

  function scrollToTickets() {
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section
      id="tickets"
      className="relative z-20 isolate scroll-mt-20 bg-[var(--bg)] px-3 py-10 shadow-[0_-12px_32px_var(--bg)] sm:px-6 sm:py-14"
    >
      {/* Alias for /#plans; parent join page may also set #tickets on a wrapper. */}
      <div id="plans" className="h-0 scroll-mt-20" aria-hidden tabIndex={-1} />

      <div
        className={`transition-all ${
          highlightPaid ? "ring-2 ring-[var(--tier-trim-strong)]/40 rounded-2xl p-2" : ""
        }`}
      >
        <MembershipTicketGrid
          mode="landing"
          showBrand={false}
          showFanArt={false}
          heading="Choose your ticket"
          subheading="Free Explorer, Coach Class, Business Class, First Class — pick your seat and we’ll get you rolling."
          onFreeSelect={() => setFreeModalOpen(true)}
          onPaidSelect={(tierId) => handleTicketClick(tierId)}
          highlightPaid={highlightPaid}
        />
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/join/questions"
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline"
        >
          Not sure? 1-minute assessment →
        </Link>
        <span className="hidden text-[#3d2660] sm:inline">·</span>
        {!purchaseAuth.signedIn ? (
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Already have access? Sign in
          </Link>
        ) : null}
      </div>

      <FreeTicketModal
        open={freeModalOpen}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        welcomeVideoUrl={welcomeVideoUrl}
        gagConfig={gagConfig}
        purchaseAuth={purchaseAuth}
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
