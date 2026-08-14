"use client";

import { useState } from "react";
import Link from "next/link";
import FreeTicketModal from "@/components/FreeTicketModal";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import ShareFreeTicketButton from "@/components/ShareFreeTicketButton";
import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import { startFreeTicketGagFromGesture } from "@/lib/play-free-ticket-gag";
import type { PurchaseAuth } from "@/lib/member-purchase-path";

export default function FreeTicketGiftLanding({
  freeChastiseVideoUrl = null,
  welcomeVideoUrl = null,
  purchaseAuth: purchaseAuthProp,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  purchaseAuth?: PurchaseAuth;
}) {
  const [open, setOpen] = useState(false);
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);

  function openTicket() {
    if (!purchaseAuth.signedIn) {
      startFreeTicketGagFromGesture();
    }
    setOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 pb-16 pt-10 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-400">
        Someone sent you a ticket
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Free Explorer
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Open it. The surprise is a real membership — not a YouTube link.
      </p>

      <button
        type="button"
        onClick={openTicket}
        data-analytics-action="open-shared-free-ticket"
        className="mt-8 w-full max-w-xs overflow-hidden rounded-2xl border border-amber-500/30 shadow-2xl transition hover:border-amber-400/60 hover:shadow-amber-900/40"
      >
        <MembershipSeatArt ticketId="free" priority className="w-full" alt="Free Explorer ticket" />
      </button>

      <button
        type="button"
        onClick={openTicket}
        data-analytics-action="open-shared-free-ticket"
        className="mt-6 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-[#7c3aed] text-sm font-semibold text-white transition hover:bg-[#6d2dd6]"
      >
        Open your ticket
      </button>

      <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Then pass it on
      </p>
      <div className="mt-3 w-full max-w-xs">
        <ShareFreeTicketButton label="Share this Free ticket" />
      </div>

      <Link
        href="/join#tickets"
        className="mt-8 text-sm text-[var(--muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
      >
        See Coach Class &amp; 1st Class
      </Link>

      {open ? (
        <FreeTicketModal
          open
          freeChastiseVideoUrl={freeChastiseVideoUrl}
          welcomeVideoUrl={welcomeVideoUrl}
          purchaseAuth={purchaseAuth}
          onClose={() => setOpen(false)}
          onUpgrade={() => {
            setOpen(false);
            window.location.href = "/join#tickets";
          }}
        />
      ) : null}
    </div>
  );
}
