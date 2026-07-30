import { mergeTicketPrices, TICKET_TIERS, type TicketTier } from "@/lib/landing-tickets";

export type LandingNavSection = {
  id: string;
  label: string;
  href: string;
};

/** In-page story anchors on home. Memberships live at /join (no ticket art on home). */
export const LANDING_NAV_SECTIONS: LandingNavSection[] = [
  { id: "coming-soon-programs", label: "Programs", href: "#coming-soon-programs" },
  { id: "services", label: "Services", href: "#services" },
];

export type LandingMembershipNavItem = {
  id: string;
  label: string;
  shortLabel: string;
  price: string;
  priceNote?: string;
  priceDisplay: string;
  /** Always a signup/join path — never #ticket-… on the landing page. */
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
    const signupHref =
      tier.id === "free"
        ? "/signup?plan=explorer"
        : `/signup?plan=${encodeURIComponent(tier.signupPlan)}`;
    return {
      id: tier.id,
      label: tier.id === "free" ? "Explorer" : tier.title,
      shortLabel: tier.title,
      price: tier.price,
      priceNote: tier.priceNote,
      priceDisplay,
      href: signupHref,
      signupHref,
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
