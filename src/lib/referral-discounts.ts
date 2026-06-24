import "server-only";

import { getReferralCodeByCode } from "@/lib/referral-codes-store";

export type CheckoutDiscount = {
  promotionCode?: string;
  coupon?: string;
};

export type ResolvedReferralDiscount = {
  referralCode: string;
  label: string;
  ownerUserId: string | null;
  discount: CheckoutDiscount | null;
};

export async function resolveReferralDiscount(
  rawCode: string | null | undefined,
): Promise<ResolvedReferralDiscount | null> {
  const code = rawCode?.trim();
  if (!code) return null;

  const entry = await getReferralCodeByCode(code);
  if (!entry || !entry.enabled) {
    return {
      referralCode: code.trim().toUpperCase(),
      label: code.trim().toUpperCase(),
      ownerUserId: null,
      discount: null,
    };
  }

  const discount: CheckoutDiscount | null =
    entry.stripePromotionCodeId
      ? { promotionCode: entry.stripePromotionCodeId }
      : entry.stripeCouponId
        ? { coupon: entry.stripeCouponId }
        : null;

  return {
    referralCode: entry.code,
    label: entry.label,
    ownerUserId: entry.ownerUserId,
    discount,
  };
}

export function referralDiscountsEnabled(): boolean {
  return process.env.STRIPE_REFERRAL_DISCOUNTS_ENABLED !== "false";
}