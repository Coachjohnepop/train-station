import "server-only";

import { isDemoMode } from "@/lib/demo-enrollments";
import { prisma } from "@/lib/prisma";
import { commissionCents } from "@/lib/affiliate/commission";
import { commissionRateForAffiliateCode } from "@/lib/affiliate/promotions";
import { normalizeAffiliateCode } from "@/lib/affiliate/cookies";

/**
 * First paid Stripe membership for this member, if their referral code belongs
 * to an active affiliate. Later payments and staff grants do not add another row.
 */
function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export async function attributeAffiliateConversion(input: {
  userId: string;
  amountCents: number;
  plan: string | null;
  checkoutSessionId: string | null;
  invoiceId?: string | null;
  /** subscription_create is the first invoice. Later cycles are renewals. */
  billingReason?: string | null;
  referralCode: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  if (input.amountCents <= 0) return;
  const code = normalizeAffiliateCode(input.referralCode);
  if (!code) return;

  const discount = await prisma.affiliateCode.findUnique({
    where: { code },
    include: { affiliate: true },
  });
  const affiliate =
    discount?.isActive && discount.affiliate.status === "ACTIVE"
      ? discount.affiliate
      : await prisma.affiliate.findUnique({ where: { referralCode: code } });
  if (!affiliate || affiliate.status !== "ACTIVE") return;

  const storedRate =
    discount && discount.affiliateId === affiliate.id
      ? discount.commissionRate
      : affiliate.commissionRate;
  const rate =
    discount && discount.affiliateId === affiliate.id
      ? await commissionRateForAffiliateCode(storedRate)
      : storedRate;
  const earned = commissionCents(input.amountCents, rate);
  const codeId = discount && discount.affiliateId === affiliate.id ? discount.id : null;
  const months = affiliate.commissionMonths ?? 0;

  try {
    await prisma.$transaction(async (tx) => {
      if (input.invoiceId) {
        const stamped = await tx.affiliateConversion.findUnique({
          where: { stripeInvoiceId: input.invoiceId },
          select: { id: true },
        });
        if (stamped) return;
      }
      if (input.checkoutSessionId) {
        const stamped = await tx.affiliateConversion.findFirst({
          where: { stripeCheckoutSessionId: input.checkoutSessionId },
          select: { id: true },
        });
        if (stamped) return;
      }

      const prior = await tx.affiliateConversion.findFirst({
        where: { userId: input.userId, affiliateId: affiliate.id, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
      });

      if (prior && input.billingReason === "subscription_create" && !prior.stripeInvoiceId && input.invoiceId) {
        await tx.affiliateConversion.update({
          where: { id: prior.id },
          data: { stripeInvoiceId: input.invoiceId },
        });
        return;
      }

      if (months <= 0) {
        if (prior) return;
      } else if (prior && new Date() > addMonths(prior.createdAt, months)) {
        return;
      }

      const firstForMember = !prior;
      await tx.affiliateConversion.create({
        data: {
          affiliateId: affiliate.id,
          userId: input.userId,
          affiliateCodeId: codeId,
          plan: input.plan,
          orderSubtotalCents: input.amountCents,
          discountCents: 0,
          commissionRate: rate,
          commissionCents: earned,
          status: "APPROVED",
          stripeCheckoutSessionId: input.checkoutSessionId,
          stripeInvoiceId: input.invoiceId ?? null,
        },
      });
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data: {
          ...(firstForMember ? { totalOrders: { increment: 1 } } : {}),
          totalRevenueCents: { increment: input.amountCents },
          totalCommissionCents: { increment: earned },
          pendingBalanceCents: { increment: earned },
        },
      });
      if (codeId && firstForMember) {
        await tx.affiliateCode.update({
          where: { id: codeId },
          data: { usageCount: { increment: 1 } },
        });
      }
    });
  } catch (error) {
    console.warn(
      "[affiliate] conversion skipped",
      input.userId,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Drop an unpaid commission when the membership charge is fully refunded. */
export async function cancelUnpaidAffiliateConversion(userId: string): Promise<void> {
  if (isDemoMode()) return;
  const rows = await prisma.affiliateConversion.findMany({
    where: { userId, status: { in: ["PENDING", "APPROVED"] }, payoutId: null },
  });
  if (rows.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.affiliateConversion.update({
        where: { id: row.id },
        data: { status: "CANCELLED" },
      });
      await tx.affiliate.update({
        where: { id: row.affiliateId },
        data: {
          totalRevenueCents: { decrement: row.orderSubtotalCents },
          totalCommissionCents: { decrement: row.commissionCents },
          pendingBalanceCents: { decrement: row.commissionCents },
        },
      });
    }
    const affiliateIds = [...new Set(rows.map((row) => row.affiliateId))];
    for (const affiliateId of affiliateIds) {
      const still = await tx.affiliateConversion.count({
        where: { userId, affiliateId, status: { not: "CANCELLED" } },
      });
      if (still === 0) {
        await tx.affiliate.update({
          where: { id: affiliateId },
          data: { totalOrders: { decrement: 1 } },
        });
      }
    }
  });
}
