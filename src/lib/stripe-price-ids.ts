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

/**
 * Normalize common paste mistakes (sk_Live_ / pk_Live_ / sk_Test_).
 * Stripe prefixes are lowercase; wrong casing → "Invalid API Key".
 */
export function normalizeStripeKey(raw: string | null | undefined): string {
  const key = (raw || "").trim();
  if (!key) return "";
  return key
    .replace(/^sk_Live_/i, (m) => (m.endsWith("Live_") || m.includes("Live") ? "sk_live_" : m))
    .replace(/^sk_Test_/i, "sk_test_")
    .replace(/^pk_Live_/i, "pk_live_")
    .replace(/^pk_Test_/i, "pk_test_")
    .replace(/^rk_Live_/i, "rk_live_")
    .replace(/^rk_Test_/i, "rk_test_")
    .replace(/^rkcs_Live/i, "rkcs_live")
    .replace(/^rkcs_Test/i, "rkcs_test")
    .replace(/^whsec_/i, "whsec_");
}

/** Fix only the mode segment so sk_Live_xxx → sk_live_xxx without mangling the secret body. */
export function normalizeStripeSecretKey(raw: string | null | undefined): string {
  const key = (raw || "").trim();
  if (!key) return "";
  if (/^sk_Live_/i.test(key)) return "sk_live_" + key.slice("sk_Live_".length);
  if (/^sk_Test_/i.test(key)) return "sk_test_" + key.slice("sk_Test_".length);
  if (/^rk_Live_/i.test(key)) return "rk_live_" + key.slice("rk_Live_".length);
  if (/^rk_Test_/i.test(key)) return "rk_test_" + key.slice("rk_Test_".length);
  if (/^rkcs_Live/i.test(key)) return "rkcs_live" + key.slice("rkcs_Live".length);
  if (/^rkcs_Test/i.test(key)) return "rkcs_test" + key.slice("rkcs_Test".length);
  return key;
}

export function normalizeStripePublishableKey(raw: string | null | undefined): string {
  const key = (raw || "").trim();
  if (!key) return "";
  if (/^pk_Live_/i.test(key)) return "pk_live_" + key.slice("pk_Live_".length);
  if (/^pk_Test_/i.test(key)) return "pk_test_" + key.slice("pk_Test_".length);
  return key;
}

export function isStripeTestMode(): boolean {
  const key = normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY);
  // Standard + restricted keys (rk_ / rkcs_)
  return (
    key.startsWith("sk_test_") ||
    key.startsWith("rk_test_") ||
    key.startsWith("rkcs_test")
  );
}

export function isStripeLiveMode(): boolean {
  const key = normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY);
  return (
    key.startsWith("sk_live_") ||
    key.startsWith("rk_live_") ||
    key.startsWith("rkcs_live")
  );
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