import { NextResponse } from "next/server";
import { getEffectiveMembershipOffers } from "@/lib/pricing-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const offers = await getEffectiveMembershipOffers();
  return NextResponse.json({
    tickets: offers.map((offer) => ({
      plan: offer.id,
      title: offer.id === "explorer" ? "Free" : offer.shortLabel,
      subtitle: offer.id === "explorer" ? "Explorer" : "Ticket",
      price: offer.priceLabel,
      priceNote: offer.priceNote,
      priceDisplay: offer.priceDisplay,
      signupPlan: offer.id,
      perks: offer.perks || [],
      checkoutMode: offer.checkoutMode,
    })),
  });
}