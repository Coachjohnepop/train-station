"use client";

import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { resolveProgramImage } from "@/lib/program-constants";
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

  const altById: Record<string, string> = {
    speaking_fee: "Coach Jeremy speaking at a seminar",
    team_consultation: "Coach training a football team on the field",
    custom_training: "Coach consulting with an athletic director while a volleyball team practices",
    merchandise: "Affordable home gear — bands, dumbbells, bench, and simple kit",
  };

  return (
    <>
      {SERVICE_OFFERS.map((offer, index) => {
        const img = resolveProgramImage(offer.id);
        const isSpeaking = offer.id === "speaking_fee";
        const cta = isSpeaking
          ? "Book speaking →"
          : offer.checkoutMode === "quote"
            ? "Request quote →"
            : "Learn more →";
        return (
          <button
            key={offer.id}
            id={index === 0 ? "services" : undefined}
            type="button"
            onClick={() => openOffer(offer.id)}
            className="explore-feed-card"
          >
            <span className="explore-feed-media">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={altById[offer.id] || offer.label} />
              ) : null}
              {isSpeaking ? (
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#042f1a]">
                  Available
                </span>
              ) : null}
            </span>
            <span className="explore-feed-copy">
              <span className="explore-feed-kicker">Services &amp; extras</span>
              <span className="explore-feed-title block">{offer.label}</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--accent-fg)]">
                {offer.priceLabel}
                {offer.priceNote ? ` ${offer.priceNote}` : ""}
              </span>
              <p className="explore-feed-blurb">{offer.description}</p>
              <span className="explore-feed-cta">{cta}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}