import type { SignupPlan } from "@/lib/signup-plans";

/** Checkout behavior for each sellable offer. */
export type OfferCheckoutMode =
  | "free"
  | "subscription"
  | "one_time"
  | "quote"
  | "custom_offer";

export type OfferCategory = "membership" | "package" | "service" | "merchandise";

export type CustomTrainingParameters = {
  daysPerWeek: number;
  minutesPerSession: number;
  sessionsPerDay: number;
  /** Weekday keys: mon,tue,wed,thu,fri,sat,sun */
  dropInDays: string[];
  notes: string | null;
};

export type ProductOfferDefinition = {
  id: SignupPlan | ServiceOfferId;
  label: string;
  shortLabel: string;
  category: OfferCategory;
  checkoutMode: OfferCheckoutMode;
  priceLabel: string;
  priceNote?: string;
  description: string;
  /** Env var holding Stripe price_… for fixed checkout modes */
  stripePriceEnv?: string;
  /** Default list price in cents when using dynamic price_data */
  defaultPriceCents?: number;
  perks?: string[];
  /** Member access tier after purchase */
  accessTier?: "coach" | "first_class";
  /** One-time package metadata applied to member profile on pay */
  intensivePackage?: {
    sessionsTotal: number;
    windowDays: number;
  };
};

/** Non-membership offers (services + merch) — use same normalize path where possible */
export const SERVICE_OFFER_IDS = [
  "team_consultation",
  "speaking_fee",
  "custom_training",
  "merchandise",
] as const;

export type ServiceOfferId = (typeof SERVICE_OFFER_IDS)[number];

export type AnyOfferId = SignupPlan | ServiceOfferId;

export const MEMBERSHIP_OFFERS: ProductOfferDefinition[] = [
  {
    id: "explorer",
    label: "Free Explorer",
    shortLabel: "Explorer",
    category: "membership",
    checkoutMode: "free",
    priceLabel: "$0",
    priceNote: "starter access",
    description: "Starter programs and basic logging.",
    accessTier: "coach",
    perks: ["Starter programs", "Basic logging"],
  },
  {
    id: "member",
    label: "Coach Class",
    shortLabel: "Coach Class",
    category: "membership",
    checkoutMode: "subscription",
    priceLabel: "$25",
    priceNote: "/mo",
    description: "All programs, coach Zoom, and SMS accountability.",
    stripePriceEnv: "STRIPE_PRICE_MEMBER",
    accessTier: "coach",
    perks: ["All programs — 4-week blocks", "15-min coach Zoom", "SMS accountability texts"],
  },
  {
    id: "business",
    label: "Business Class",
    shortLabel: "Business Class",
    category: "membership",
    checkoutMode: "subscription",
    priceLabel: "$50",
    priceNote: "/mo",
    description: "Corporate and business membership with full site access.",
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
    accessTier: "first_class",
    perks: ["Full member access", "Business billing", "Priority coach support"],
  },
  {
    id: "pro",
    label: "1st Class",
    shortLabel: "1st Class",
    category: "membership",
    checkoutMode: "one_time",
    priceLabel: "$850",
    priceNote: "one-time",
    description:
      "Eight 1-hour private sessions with Coach Byrd within a 30-day window, plus full 1st Class site access.",
    stripePriceEnv: "STRIPE_PRICE_PRO",
    defaultPriceCents: 85_000,
    accessTier: "first_class",
    intensivePackage: { sessionsTotal: 8, windowDays: 30 },
    perks: [
      "8 × 1-hour 1-on-1 sessions with Coach Byrd",
      "Use within 30 days",
      "Full 1st Class member access",
      "Live Zoom with John & Steph",
    ],
  },
];

export const SERVICE_OFFERS: ProductOfferDefinition[] = [
  {
    id: "team_consultation",
    label: "Team Consultation Program",
    shortLabel: "Team consultation",
    category: "service",
    checkoutMode: "quote",
    priceLabel: "Custom",
    priceNote: "per engagement",
    description: "Team workshops, culture, and performance consulting — priced per scope.",
  },
  {
    id: "speaking_fee",
    label: "Speaking Fee Program",
    shortLabel: "Speaking",
    category: "service",
    checkoutMode: "quote",
    priceLabel: "Custom",
    priceNote: "per event",
    description: "Keynotes and speaking engagements — custom fee per event.",
  },
  {
    id: "custom_training",
    label: "Custom Priced Training",
    shortLabel: "Custom training",
    category: "service",
    checkoutMode: "custom_offer",
    priceLabel: "Custom",
    priceNote: "coach sets terms",
    description:
      "Jeremy configures days per week, session length, sessions per day, drop-in days, and price.",
  },
  {
    id: "merchandise",
    label: "Merchandise",
    shortLabel: "Merch",
    category: "merchandise",
    checkoutMode: "one_time",
    priceLabel: "Per unit",
    description: "Train Station gear and retail — per-unit Stripe pricing.",
    stripePriceEnv: "STRIPE_PRICE_MERCH_DEFAULT",
  },
];

const ALL_OFFERS = [...MEMBERSHIP_OFFERS, ...SERVICE_OFFERS];

export function getOfferDefinition(id: string | null | undefined): ProductOfferDefinition | null {
  const key = (id || "").trim().toLowerCase();
  if (!key) return null;
  return ALL_OFFERS.find((o) => o.id === key) ?? null;
}

export function stripePriceIdForOffer(id: string): string | null {
  const offer = getOfferDefinition(id);
  if (!offer?.stripePriceEnv) return null;
  const primary = process.env[offer.stripePriceEnv]?.trim();
  if (primary) return primary;
  // Legacy env name before 1st Class merged into single $850 package
  if (id === "pro") {
    return process.env.STRIPE_PRICE_FIRST_CLASS_1ON1?.trim() || null;
  }
  return null;
}

export function isQuoteOffer(id: string): boolean {
  return getOfferDefinition(id)?.checkoutMode === "quote";
}

export function isPaidOffer(id: string): boolean {
  const offer = getOfferDefinition(id);
  if (!offer) return false;
  return offer.checkoutMode === "subscription" || offer.checkoutMode === "one_time";
}

export function isCustomOfferCheckout(id: string): boolean {
  return getOfferDefinition(id)?.checkoutMode === "custom_offer";
}

export const WEEKDAY_OPTIONS = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
] as const;

export function formatCustomTrainingSummary(params: CustomTrainingParameters): string {
  const days = params.dropInDays.length > 0 ? params.dropInDays.join(", ") : "flexible";
  return `${params.daysPerWeek}d/wk · ${params.sessionsPerDay} session(s)/day · ${params.minutesPerSession} min · drop-in: ${days}`;
}

export const COMING_SOON_PROGRAMS = [
  {
    slug: "military-prep",
    name: "Military Preparation",
    emoji: "🎖️",
    blurb: "Conditioning and resilience work to prepare for military service.",
  },
  {
    slug: "stretching",
    name: "Stretching",
    emoji: "🧘",
    blurb: "Daily mobility flows — coming soon.",
  },
  {
    slug: "nutrition",
    name: "Nutrition",
    emoji: "🥗",
    blurb: "Habits, macros, and coach-guided eating.",
  },
  {
    slug: "yoga",
    name: "Yoga",
    emoji: "🕉️",
    blurb: "Recovery, breath, and flexibility tracks.",
  },
  {
    slug: "glute-building",
    name: "Glute Building",
    emoji: "🍑",
    blurb: "Progressive glute specialization program.",
  },
] as const;