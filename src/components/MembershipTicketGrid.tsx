"use client";

import Link from "next/link";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import TrainStationBrand from "@/components/TrainStationBrand";
import {
  TICKET_TIERS,
  mergeTicketPrices,
  type TicketTier,
  type TicketTierId,
} from "@/lib/landing-tickets";
import { DUAL_TICKETS_FAN_SRC } from "@/lib/membership-theme";
import { useEffect, useState } from "react";

/**
 * Landing-style train seat ticket grid (same art + card chrome as /#tickets).
 * Used on home and post-signup Explorer checkout so tickets feel like one product.
 */
export default function MembershipTicketGrid({
  mode = "landing",
  promoCode = "",
  onFreeSelect,
  onPaidSelect,
  highlightPaid = false,
  className = "",
  showBrand = true,
  heading = "Membership tickets",
  subheading = "Tap a ticket on your phone — side by side, no guessing. We'll guide you through setup after you choose.",
}: {
  /** landing = free/paid via callbacks; checkout = free → today, paid → plan checkout */
  mode?: "landing" | "checkout";
  promoCode?: string;
  onFreeSelect?: () => void;
  onPaidSelect?: (tierId: TicketTierId) => void;
  highlightPaid?: boolean;
  className?: string;
  showBrand?: boolean;
  heading?: string;
  subheading?: string;
}) {
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
        /* static fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function paidCheckoutHref(plan: string): string {
    const q = new URLSearchParams({ plan });
    const promo = promoCode.trim();
    if (promo) q.set("promo", promo);
    return `/member/checkout?${q.toString()}`;
  }

  function handleClick(tier: TicketTier) {
    if (tier.id === "free") {
      onFreeSelect?.();
      return;
    }
    if (mode === "landing") {
      onPaidSelect?.(tier.id);
      return;
    }
    window.location.href = paidCheckoutHref(tier.signupPlan);
  }

  return (
    <div className={className}>
      <div className="mx-auto max-w-4xl text-center">
        {showBrand ? <TrainStationBrand variant="compact" className="mb-6" /> : null}
        {/* Dual tickets fanned like cards — signature membership graphic */}
        <div className="mx-auto mb-5 max-w-[280px] sm:max-w-[340px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DUAL_TICKETS_FAN_SRC}
            alt="Coach Class and First Class tickets fanned like playing cards"
            className="mx-auto w-full drop-shadow-[0_12px_40px_rgba(124,58,237,0.45)]"
            width={1152}
            height={864}
          />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent)]">
          Pick your ticket
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
          {heading}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{subheading}</p>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiers.map((tier) => {
          const isFree = tier.id === "free";
          const paidHighlight = highlightPaid && !isFree;
          const inner = (
            <>
              {tier.seatArtSrc ? (
                <MembershipSeatArt ticketId={tier.id} className="ticket-card__art" />
              ) : (
                <div className="ticket-card__art bg-gradient-to-br from-zinc-700/40 to-zinc-900/60" />
              )}
              <div className="ticket-card__body relative z-10">
                <div className="pointer-events-none absolute right-0 top-0 h-3 w-3 rounded-full border border-dashed border-white/20 sm:h-4 sm:w-4" />
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 sm:text-[10px]">
                  {isFree && mode === "checkout" ? "Current" : tier.subtitle}
                </div>
                <div className="mt-1 text-sm font-bold leading-tight text-white sm:text-lg">
                  {tier.title}
                </div>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-xl font-semibold text-white sm:text-3xl">{tier.price}</span>
                  {tier.priceNote ? (
                    <span className="text-[10px] text-white/60 sm:text-xs">{tier.priceNote}</span>
                  ) : null}
                </div>
                <ul className="mt-2 flex-1 space-y-0.5">
                  {tier.perks.slice(0, 3).map((p) => (
                    <li key={p} className="text-[9px] leading-snug text-white/75 sm:text-xs">
                      · {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-2 inline-block text-[10px] font-semibold text-[#c4b5fd] group-hover:text-white sm:text-xs">
                  {isFree
                    ? mode === "checkout"
                      ? "Stay free →"
                      : "Tap if you dare →"
                    : "Select →"}
                </span>
              </div>
            </>
          );

          const cardClass = `group relative isolate flex min-h-[200px] flex-col overflow-hidden rounded-xl border text-left shadow-lg transition-all active:scale-[0.97] sm:min-h-[280px] sm:rounded-2xl ${tier.themeClass} ${
            paidHighlight ? "scale-[1.02] shadow-[var(--tier-trim-glow)]" : "hover:scale-[1.02]"
          }`;

          if (mode === "checkout" && isFree) {
            return (
              <Link key={tier.id} id={`ticket-${tier.id}`} href="/member/today" className={cardClass}>
                {inner}
              </Link>
            );
          }

          if (mode === "checkout" && !isFree) {
            return (
              <Link
                key={tier.id}
                id={`ticket-${tier.id}`}
                href={paidCheckoutHref(tier.signupPlan)}
                className={cardClass}
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={tier.id}
              id={`ticket-${tier.id}`}
              type="button"
              onClick={() => handleClick(tier)}
              className={cardClass}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { TicketTierId };
