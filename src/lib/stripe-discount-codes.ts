import "server-only";

/**
 * Discount / promo codes for membership Checkout.
 *
 * Admin creates Stripe coupon + promotion code (Admin → Billing → Discounts).
 * Members type the code on /member/checkout or use Stripe’s promo field when
 * allow_promotion_codes is on.
 *
 * Scope:
 * - subscription → Coach Class + Business Class products only
 * - one_time → 1st Class (and other one-time membership packages)
 * - all → no product restriction
 */

import { getStripe } from "@/lib/stripe";
import { resolveStripePriceId } from "@/lib/pricing-catalog";
import type { CheckoutDiscount } from "@/lib/referral-discounts";

export type DiscountAppliesTo = "subscription" | "one_time" | "all";

/** Plans used to resolve Stripe product IDs for coupon.applies_to. */
const SUBSCRIPTION_PLAN_IDS = ["member", "business"] as const;
const ONE_TIME_PLAN_IDS = ["pro"] as const;

export async function stripeProductIdsForDiscountScope(
  appliesTo: DiscountAppliesTo,
): Promise<string[]> {
  if (appliesTo === "all") return [];

  const stripe = getStripe();
  if (!stripe) return [];

  const planIds =
    appliesTo === "subscription" ? SUBSCRIPTION_PLAN_IDS : ONE_TIME_PLAN_IDS;
  const productIds = new Set<string>();

  for (const planId of planIds) {
    const priceId = await resolveStripePriceId(planId);
    if (!priceId) continue;
    try {
      const price = await stripe.prices.retrieve(priceId);
      const product =
        typeof price.product === "string" ? price.product : price.product?.id;
      if (product) productIds.add(product);
    } catch {
      /* skip missing/invalid price */
    }
  }

  return [...productIds];
}

/**
 * Look up an active Stripe promotion code by human code (e.g. FEEDBACK50).
 * Also accepts a promo_… id.
 */
export async function resolveStripePromotionCode(
  raw: string | null | undefined,
): Promise<CheckoutDiscount | null> {
  const code = raw?.trim();
  if (!code) return null;

  const stripe = getStripe();
  if (!stripe) return null;

  if (code.startsWith("promo_")) {
    try {
      const promo = await stripe.promotionCodes.retrieve(code);
      if (!promo.active) return null;
      return { promotionCode: promo.id };
    } catch {
      return null;
    }
  }

  if (code.startsWith("coupon_")) {
    try {
      const coupon = await stripe.coupons.retrieve(code);
      if (!coupon.valid) return null;
      return { coupon: coupon.id };
    } catch {
      return null;
    }
  }

  const normalized = code.toUpperCase().replace(/\s+/g, "");
  try {
    const listed = await stripe.promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
    });
    const hit = listed.data[0];
    if (!hit) return null;
    return { promotionCode: hit.id };
  } catch {
    return null;
  }
}

export function discountAppliesToLabel(appliesTo: DiscountAppliesTo): string {
  if (appliesTo === "subscription") return "Recurring memberships only";
  if (appliesTo === "one_time") return "One-time packages only";
  return "All paid products";
}
