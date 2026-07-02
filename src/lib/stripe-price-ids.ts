import "server-only";

import type { MembershipPlan } from "@/lib/signup-plans";

type PaidMembershipPlan = Exclude<MembershipPlan, "explorer">;

/** Jeremy test-mode Stripe prices — source of truth while demo checkout is validated. */
export const MEMBERSHIP_STRIPE_PRICE_IDS: Record<PaidMembershipPlan, string> = {
  member: "price_1TmcM1HE54Aq5KQ766WFGRep",
  business: "price_1TmcPpHE54Aq5KQ7dUv6REuM",
  pro: "price_1TmcQOHE54Aq5KQ7H3G9s997",
};

/** Test publishable key for embedded Checkout (acct_1TmKT3HE54Aq5KQ7). */
export const STRIPE_TEST_PUBLISHABLE_KEY =
  "pk_test_51TmKT3HE54Aq5KQ7yqbk3xVydmxm8XDFEbAC5eJH2PDVnWggqWobxVLFdxR8GqPu9f5iKvDM0p8Q2Enkmq9PeQFb00TDcHnB2i";

export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_");
}

/** Test-mode demo prices only — never override env when sk_live is set. */
export function canonicalMembershipPriceId(planId: string): string | null {
  if (process.env.STRIPE_USE_CANONICAL_PRICES === "false") return null;
  if (!isStripeTestMode()) return null;
  if (planId === "member" || planId === "business" || planId === "pro") {
    return MEMBERSHIP_STRIPE_PRICE_IDS[planId];
  }
  return null;
}