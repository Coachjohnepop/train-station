import { mergeTicketPrices, TICKET_TIERS, type TicketTier } from "@/lib/landing-tickets";

export type LandingNavSection = {
  id: string;
  label: string;
  href: string;
};

export const LANDING_NAV_SECTIONS: LandingNavSection[] = [
  { id: "tickets", label: "Memberships", href: "#tickets" },
  { id: "services", label: "Services", href: "#services" },
  { id: "coming-soon-programs", label: "Programs", href: "#coming-soon-programs" },
];

export type LandingMembershipNavItem = {
  id: string;
  label: string;
  shortLabel: string;
  price: string;
  priceNote?: string;
  priceDisplay: string;
  href: string;
  signupHref: string;
  signupPlan: string;
};

export type PublicTicketApiRow = {
  plan: string;
  title: string;
  price: string;
  priceNote?: string;
  priceDisplay?: string;
};

export function buildMembershipNavItems(
  apiTickets: PublicTicketApiRow[] | null | undefined,
): LandingMembershipNavItem[] {
  const tiers: TicketTier[] = apiTickets?.length
    ? mergeTicketPrices(apiTickets)
    : TICKET_TIERS;

  return tiers.map((tier) => {
    const priceDisplay =
      tier.priceNote && tier.priceNote.startsWith("/")
        ? `${tier.price}${tier.priceNote}`
        : tier.priceNote
          ? `${tier.price} ${tier.priceNote}`
          : tier.price;
    return {
      id: tier.id,
      label: tier.id === "free" ? "Explorer" : tier.title,
      shortLabel: tier.title,
      price: tier.price,
      priceNote: tier.priceNote,
      priceDisplay,
      href: `#ticket-${tier.id}`,
      signupHref:
        tier.id === "free"
          ? "/signup?plan=explorer"
          : `/signup?plan=${encodeURIComponent(tier.signupPlan)}`,
      signupPlan: tier.signupPlan,
    };
  });
}

export function landingNavHref(href: string, onHomePage: boolean): string {
  if (href.startsWith("#") && !onHomePage) {
    return `/${href}`;
  }
  return href;
}