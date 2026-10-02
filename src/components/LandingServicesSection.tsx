"use client";

import { usePurchaseAuth } from "@/hooks/usePurchaseAuth";
import {
  emptyExploreContent,
  resolveExploreCards,
  type ResolvedExploreCard,
} from "@/lib/explore-content";
import { purchaseHref, type PurchaseAuth } from "@/lib/member-purchase-path";
import { SERVICE_OFFERS } from "@/lib/product-offers";

export default function LandingServicesSection({
  purchaseAuth: purchaseAuthProp,
  cards,
}: {
  purchaseAuth?: PurchaseAuth;
  cards?: ResolvedExploreCard[];
}) {
  const purchaseAuth = usePurchaseAuth(purchaseAuthProp);
  const resolved = cards?.length
    ? cards.filter((card) => card.kind === "service")
    : resolveExploreCards(emptyExploreContent()).filter((card) => card.kind === "service");

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
      {resolved.map((card, index) => {
        const offer = SERVICE_OFFERS.find((row) => row.id === card.id);
        const img = card.imageUrl;
        const isSpeaking = card.id === "speaking_fee";
        const cta = isSpeaking
          ? "Book speaking →"
          : offer?.checkoutMode === "quote"
            ? "Request quote →"
            : "Learn more →";
        return (
          <button
            key={card.id}
            id={index === 0 ? "services" : undefined}
            type="button"
            onClick={() => openOffer(card.id)}
            className="explore-feed-card"
            data-explore-card={card.id}
          >
            <span className="explore-feed-media">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={altById[card.id] || card.name} />
              ) : null}
              {isSpeaking ? (
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#042f1a]">
                  Available
                </span>
              ) : null}
            </span>
            <span className="explore-feed-copy">
              <span className="explore-feed-kicker">{card.subtitle}</span>
              <span className="explore-feed-title block">{card.name}</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--accent-fg)]">
                {card.priceLabel}
                {card.priceNote ? ` ${card.priceNote}` : ""}
              </span>
              <p className="explore-feed-blurb">{card.description}</p>
              <span className="explore-feed-cta">{cta}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}