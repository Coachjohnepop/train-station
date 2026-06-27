/** Canonical Stripe test-mode price IDs for Train Station memberships. */
export const STRIPE_PRICE_IDS = {
  member: "price_1TmcM1HE54Aq5KQ7W6WFGRep",
  business: "price_1TmcPpHE54Aq5KQ7dUv6REUM",
  pro: "price_1TmcQQHE54Aq5KQ7H3G9s997",
};

export const STRIPE_PRICE_LABELS = {
  member: { label: "Coach Class", priceCents: 2500 },
  business: { label: "Business Class", priceCents: 5000 },
  pro: { label: "1st Class", priceCents: 85000 },
};