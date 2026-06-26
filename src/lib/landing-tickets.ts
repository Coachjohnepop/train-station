import { COMING_SOON_PROGRAMS, MEMBERSHIP_OFFERS } from "@/lib/product-offers";

export type TicketTierId =
  | "free"
  | "coach-class"
  | "business-class"
  | "first-class"
  | "first-class-1on1";

export type TicketTier = {
  id: TicketTierId;
  title: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  accent: string;
  signupPlan: string;
  joinRec: string;
  perks: string[];
};

const accentByPlan: Record<string, string> = {
  explorer: "from-zinc-500/20 to-zinc-800/40 border-zinc-500/40",
  member: "from-[#7c3aed]/25 to-[#4c1d95]/30 border-[#7c3aed]/50",
  business: "from-sky-500/20 to-[#4c1d95]/25 border-sky-400/40",
  pro: "from-amber-500/20 to-[#7c3aed]/20 border-amber-400/40",
  first_class_1on1: "from-rose-500/20 to-amber-500/20 border-rose-400/40",
};

const ticketIdByPlan: Record<string, TicketTierId> = {
  explorer: "free",
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
  first_class_1on1: "first-class-1on1",
};

export const TICKET_TIERS: TicketTier[] = MEMBERSHIP_OFFERS.filter((o) =>
  ["explorer", "member", "business", "pro", "first_class_1on1"].includes(o.id),
).map((offer) => ({
  id: ticketIdByPlan[offer.id] || "free",
  title: offer.id === "explorer" ? "Free" : offer.shortLabel,
  subtitle: offer.id === "explorer" ? "Explorer" : "Ticket",
  price: offer.priceLabel,
  priceNote: offer.priceNote,
  accent: accentByPlan[offer.id] || accentByPlan.member,
  signupPlan: offer.id,
  joinRec: offer.id,
  perks: offer.perks || [],
}));

export { COMING_SOON_PROGRAMS };