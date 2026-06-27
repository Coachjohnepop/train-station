import "server-only";

import type { MembershipPlan } from "@/lib/signup-plans";

type PaidMembershipPlan = Exclude<MembershipPlan, "explorer">;

/** Jeremy test-mode Stripe prices — source of truth while demo checkout is validated. */
export const MEMBERSHIP_STRIPE_PRICE_IDS: Record<PaidMembershipPlan, string> = {
  member: "price_1TmcM1HE54Aq5KQ7W6WFGRep",
  business: "price_1TmcPpHE54Aq5KQ7dUv6REUM",
  pro: "price_1TmcQQHE54Aq5KQ7H3G9s997",
};

export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_");
}

/** Demo membership prices — bypass env/blob until live Stripe catalog is wired. */
export function canonicalMembershipPriceId(planId: string): string | null {
  if (process.env.STRIPE_USE_CANONICAL_PRICES === "false") return null;
  if (planId === "member" || planId === "business" || planId === "pro") {
    return MEMBERSHIP_STRIPE_PRICE_IDS[planId];
  }
  return null;
}