import "server-only";

import { prisma } from "@/lib/prisma";
import { createReferralCode } from "@/lib/referral-codes-store";
import { createBillingDiscount } from "@/lib/stripe-billing-admin";
import { calculateCommissionRate } from "@/lib/affiliate/commission";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";

const ALLOWED_DISCOUNTS = new Set([0.05, 0.1]);

export async function createAffiliateDiscountCode(input: {
  affiliateId: string;
  affiliateName: string;
  rawCode: string;
  discountPercent: number;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const code = normalizeAffiliateCode(input.rawCode);
  if (code.length < 3 || code.length > 16) {
    return { ok: false, error: "Use 3 to 16 letters or numbers." };
  }
  if (!ALLOWED_DISCOUNTS.has(input.discountPercent)) {
    return { ok: false, error: "Discount is 5% or 10%." };
  }

  const [takenAffiliate, takenCode] = await Promise.all([
    prisma.affiliate.findUnique({ where: { referralCode: code }, select: { id: true } }),
    prisma.affiliateCode.findUnique({ where: { code }, select: { id: true } }),
  ]);
  if (takenAffiliate || takenCode) {
    return { ok: false, error: "That code is already in use." };
  }

  const commissionRate = calculateCommissionRate(input.discountPercent);
  const created = await createBillingDiscount({
    code,
    name: `${input.affiliateName} affiliate ${Math.round(input.discountPercent * 100)}%`,
    percentOff: Math.round(input.discountPercent * 100),
    duration: "once",
    appliesTo: "subscription",
    createPromotionCode: true,
  });
  if (!created.ok) {
    return { ok: false, error: created.error || "Stripe could not create that discount." };
  }

  await prisma.affiliateCode.create({
    data: {
      code,
      affiliateId: input.affiliateId,
      discountPercent: input.discountPercent,
      commissionRate,
      stripePromotionCodeId: created.promotionCodeId,
      stripeCouponId: created.couponId,
    },
  });

  try {
    await createReferralCode({
      code,
      label: `${input.affiliateName} affiliate`,
      stripePromotionCodeId: created.promotionCodeId,
      stripeCouponId: created.couponId,
      notes: "Affiliate discount. First membership invoice only.",
    });
  } catch (error) {
    console.warn("[affiliate] referral map save failed", error);
  }

  return { ok: true, code };
}
