import "server-only";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateCommissionRate } from "@/lib/affiliate/commission";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";
import type { CheckoutDiscount } from "@/lib/referral-discounts";

export type ActiveAffiliatePromotion = {
  id: string;
  name: string;
  discountPercent: number;
  stripeCouponId: string | null;
};

/** Highest active station-wide affiliate discount, if one is running. */
export async function getActiveAffiliatePromotion(): Promise<ActiveAffiliatePromotion | null> {
  const now = new Date();
  const promo = await prisma.affiliatePromotion.findFirst({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { discountPercent: "desc" },
  });
  if (!promo) return null;
  return {
    id: promo.id,
    name: promo.name,
    discountPercent: promo.discountPercent,
    stripeCouponId: promo.stripeCouponId,
  };
}

/** First-invoice coupon for a promotion. Reused after the first checkout. */
export async function ensurePromotionCoupon(promo: ActiveAffiliatePromotion): Promise<string | null> {
  if (promo.stripeCouponId) return promo.stripeCouponId;
  const stripe = getStripe();
  if (!stripe) return null;
  const percent = Math.round(promo.discountPercent);
  if (percent < 1 || percent > 40) return null;
  const coupon = await stripe.coupons.create({
    name: promo.name.slice(0, 40),
    duration: "once",
    percent_off: percent,
    metadata: { role: "affiliate_promotion", promotionId: promo.id, product: "train-station" },
  });
  await prisma.affiliatePromotion.update({
    where: { id: promo.id },
    data: { stripeCouponId: coupon.id },
  });
  return coupon.id;
}

/**
 * Eco rule: a live promotion replaces the affiliate code's own percent.
 * A plain referral link with no discount code is left alone.
 */
export async function promotionDiscountForAffiliateCode(
  rawCode: string | null | undefined,
): Promise<CheckoutDiscount | null> {
  const code = normalizeAffiliateCode(rawCode);
  if (!code) return null;
  const affiliateCode = await prisma.affiliateCode.findUnique({
    where: { code },
    select: { isActive: true },
  });
  if (!affiliateCode?.isActive) return null;
  const promo = await getActiveAffiliatePromotion();
  if (!promo) return null;
  const coupon = await ensurePromotionCoupon(promo);
  if (!coupon) return null;
  return { coupon };
}

/** Commission follows the discount the customer actually received. */
export async function commissionRateForAffiliateCode(storedRate: number): Promise<number> {
  const promo = await getActiveAffiliatePromotion();
  if (!promo) return storedRate;
  return calculateCommissionRate(promo.discountPercent / 100);
}
