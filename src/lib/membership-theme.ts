import { getOfferDefinition } from "@/lib/product-offers";
import { normalizeSignupPlan, signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import type { TicketTierId } from "@/lib/landing-tickets";

/** Visual theme keys — one per membership ticket level. */
export type MembershipThemeTier = "explorer" | "member" | "business" | "pro";

export type ThemeMode = "dark" | "light";

export const THEME_MODE_STORAGE_KEY = "ts-theme-mode";

export function membershipThemeTierFromPlan(
  plan: string | null | undefined,
): MembershipThemeTier {
  const normalized = normalizeSignupPlan(plan);
  if (normalized === "member") return "member";
  if (normalized === "business") return "business";
  if (normalized === "pro") return "pro";
  return "explorer";
}

export function membershipThemeTierFromSignupPlan(plan: SignupPlan): MembershipThemeTier {
  return membershipThemeTierFromPlan(plan);
}

export function ticketTierToThemeTier(ticketId: TicketTierId): MembershipThemeTier {
  switch (ticketId) {
    case "coach-class":
      return "member";
    case "business-class":
      return "business";
    case "first-class":
      return "pro";
    default:
      return "explorer";
  }
}

export function ticketCardClass(ticketId: TicketTierId): string {
  return `ticket-card ticket-card--${ticketId}`;
}

export const MEMBERSHIP_THEME_LABELS: Record<MembershipThemeTier, string> = {
  explorer: "Explorer",
  member: "Coach Class",
  business: "Business Class",
  pro: "1st Class",
};

/** Train car seat photography — all membership ticket tiers. */
export const TICKET_SEAT_ART: Partial<Record<TicketTierId, string>> = {
  free: "/images/tickets/free.jpg",
  "coach-class": "/images/tickets/coach-class.jpg",
  "business-class": "/images/tickets/business-class.jpg",
  "first-class": "/images/tickets/first-class.jpg",
};

/** Signature brand graphic — dual boarding tickets fanned like playing cards. */
export const DUAL_TICKETS_FAN_SRC = "/images/tickets/dual-tickets-fan.jpg";
export const DUAL_TICKETS_FAN_VELVET_SRC = "/images/tickets/dual-tickets-fan-velvet.jpg";

const PLAN_TO_TICKET: Partial<Record<SignupPlan, TicketTierId>> = {
  explorer: "free",
  member: "coach-class",
  business: "business-class",
  pro: "first-class",
};

export function seatArtForTicketId(ticketId: TicketTierId): string | null {
  return TICKET_SEAT_ART[ticketId] ?? null;
}

export function seatArtForPlan(plan: string | null | undefined): string | null {
  const normalized = normalizeSignupPlan(plan);
  const ticketId = PLAN_TO_TICKET[normalized];
  return ticketId ? seatArtForTicketId(ticketId) : null;
}

export function paymentBillingSummary(plan: SignupPlan, priceLabel?: string | null): string {
  const price = priceLabel?.trim() || getOfferDefinition(plan)?.priceLabel || "";
  switch (plan) {
    case "member":
      return price
        ? `${price} per month — recurring subscription. Cancel anytime from Account → Manage billing.`
        : "Billed monthly. Cancel anytime from your account.";
    case "business":
      return price
        ? `${price} per month — recurring subscription with full site access and priority support.`
        : "Billed monthly with full Business Class access.";
    case "pro":
      return price
        ? `${price} one-time — includes 8 private sessions within 30 days plus full 1st Class access.`
        : "One-time payment for the 1st Class intensive package.";
    default:
      return "No payment required.";
  }
}

export function paymentPerksForPlan(plan: SignupPlan): string[] {
  return getOfferDefinition(plan)?.perks ?? [];
}

export function paymentCardTitle(plan: SignupPlan): string {
  return signupPlanLabel(plan);
}