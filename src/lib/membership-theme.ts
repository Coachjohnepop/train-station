import { normalizeSignupPlan, type SignupPlan } from "@/lib/signup-plans";
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