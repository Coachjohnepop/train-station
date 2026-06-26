import { seatArtForTicketId, ticketCardClass } from "@/lib/membership-theme";
import { COMING_SOON_PROGRAMS, MEMBERSHIP_OFFERS } from "@/lib/product-offers";

export type TicketTierId = "free" | "coach-class" | "business-class" | "first-class";

export type TicketTier = {
  id: TicketTierId;
  title: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  themeClass: string;
  seatArtSrc: string | null;
  signupPlan: string;
  joinRec: string;
  perks: string[];
};

const ticketIdByPlan: Record<string, TicketTierId> = {
  explorer: "free",
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
};

export const TICKET_TIERS: TicketTier[] = MEMBERSHIP_OFFERS.filter((o) =>
  ["explorer", "member", "business", "pro"].includes(o.id),
).map((offer) => ({
  id: ticketIdByPlan[offer.id] || "free",
  title: offer.id === "explorer" ? "Free" : offer.shortLabel,
  subtitle: offer.id === "explorer" ? "Explorer" : "Ticket",
  price: offer.priceLabel,
  priceNote: offer.priceNote,
  themeClass: ticketCardClass(ticketIdByPlan[offer.id] || "free"),
  seatArtSrc: seatArtForTicketId(ticketIdByPlan[offer.id] || "free"),
  signupPlan: offer.id,
  joinRec: offer.id,
  perks: offer.perks || [],
}));

export type PublicTicketPrice = {
  plan: string;
  title: string;
  price: string;
  priceNote?: string;
};

export function mergeTicketPrices(apiTickets: PublicTicketPrice[]): TicketTier[] {
  const byPlan = new Map(apiTickets.map((t) => [t.plan, t]));
  return TICKET_TIERS.map((tier) => {
    const live = byPlan.get(tier.signupPlan);
    if (!live) return tier;
    return {
      ...tier,
      title: live.title || tier.title,
      price: live.price || tier.price,
      priceNote: live.priceNote ?? tier.priceNote,
    };
  });
}

export { COMING_SOON_PROGRAMS };