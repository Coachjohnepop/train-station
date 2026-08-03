"use client";

import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import { SERVICE_OFFERS } from "@/lib/product-offers";

export default function LandingServicesSection({
  purchaseAuth: purchaseAuthProp,
}: {
  purchaseAuth?: PurchaseAuth;
}) {
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);

  function openOffer(plan: string) {
    const quote = plan !== "merchandise" && plan !== "custom_training";
    window.location.href = purchaseHref(plan, purchaseAuth, { quote });
  }

  return (
    <section id="services" className="scroll-mt-20 bg-[var(--bg)] px-3 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c3aed]">
          Services &amp; extras
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Custom work beyond membership
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[#9d8ab8]">
          Teams, speaking, bespoke training, and merch — priced per scope or configured by your coach.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
        {SERVICE_OFFERS.map((offer) => {
          const img = PROGRAM_IMAGES[offer.id];
          const isSpeaking = offer.id === "speaking_fee";
          return (
            <button
              key={offer.id}
              type="button"
              onClick={() => openOffer(offer.id)}
              className="overflow-hidden rounded-xl border border-[#3d2660]/80 bg-gradient-to-b from-[#1a1028]/80 to-[#0a0612] text-left transition hover:border-[#7c3aed]/50"
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={isSpeaking ? "Coach Jeremy speaking at a seminar" : ""}
                  className="aspect-[16/9] w-full object-cover object-center"
                />
              ) : null}
              <div className="relative p-4">
                {isSpeaking ? (
                  <span className="absolute right-4 top-4 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                    Available
                  </span>
                ) : null}
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">
                  {offer.category}
                </div>
                <div className="mt-1 pr-16 text-lg font-semibold text-white">{offer.label}</div>
                <div className="mt-1 text-sm font-medium text-[#c4b5fd]">
                  {offer.priceLabel}
                  {offer.priceNote ? ` ${offer.priceNote}` : ""}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#9d8ab8]">{offer.description}</p>
                <span className="mt-3 inline-block text-xs font-semibold text-[#7c3aed]">
                  {isSpeaking
                    ? "Book speaking →"
                    : offer.checkoutMode === "quote"
                      ? "Request quote →"
                      : "Learn more →"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}