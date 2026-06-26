"use client";

import { SERVICE_OFFERS } from "@/lib/product-offers";

export default function LandingServicesSection() {
  function openOffer(plan: string) {
    if (plan === "merchandise") {
      window.location.href = "/signup?plan=merchandise";
      return;
    }
    if (plan === "custom_training") {
      window.location.href = "/login?redirect=%2Fmember%2Fcheckout%3Fplan%3Dcustom_training";
      return;
    }
    window.location.href = `/signup?plan=${encodeURIComponent(plan)}&quote=1`;
  }

  return (
    <section className="bg-[#0a0612] px-3 py-10 sm:px-6 sm:py-12">
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
        {SERVICE_OFFERS.map((offer) => (
          <button
            key={offer.id}
            type="button"
            onClick={() => openOffer(offer.id)}
            className="rounded-xl border border-[#3d2660]/80 bg-gradient-to-b from-[#1a1028]/80 to-[#0a0612] p-4 text-left transition hover:border-[#7c3aed]/50"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">
              {offer.category}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{offer.label}</div>
            <div className="mt-1 text-sm font-medium text-[#c4b5fd]">
              {offer.priceLabel}
              {offer.priceNote ? ` ${offer.priceNote}` : ""}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#9d8ab8]">{offer.description}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-[#7c3aed]">
              {offer.checkoutMode === "quote" ? "Request quote →" : "Learn more →"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}