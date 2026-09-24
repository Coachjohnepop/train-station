import "server-only";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const RESERVE_DEFAULT_CENTS = 50000;

export type StripeReservePosition = {
  stripeAvailableCents: number;
  stripePendingCents: number;
  balanceError: boolean;
  reserveTargetCents: number;
  approvedOwedCents: number;
  pendingOwedCents: number;
  reserveNeededCents: number;
  safeToSweepCents: number;
  reserveShortCents: number;
};

async function reserveTargetCents(): Promise<number> {
  const row = await prisma.affiliateProgramSettings.findUnique({ where: { id: "default" } });
  return row?.reserveTargetCents ?? RESERVE_DEFAULT_CENTS;
}

export async function setAffiliateReserveTarget(cents: number): Promise<void> {
  const reserveTargetCents = Math.max(0, Math.round(cents));
  await prisma.affiliateProgramSettings.upsert({
    where: { id: "default" },
    create: { id: "default", reserveTargetCents },
    update: { reserveTargetCents },
  });
}

/** Stripe cash versus the hold-back for unpaid affiliate commission. */
export async function getStripeReservePosition(): Promise<StripeReservePosition> {
  let stripeAvailableCents = 0;
  let stripePendingCents = 0;
  let balanceError = false;
  const stripe = getStripe();
  if (!stripe) {
    balanceError = true;
  } else {
    try {
      const bal = await stripe.balance.retrieve();
      stripeAvailableCents = bal.available
        .filter((b) => b.currency === "usd")
        .reduce((sum, b) => sum + b.amount, 0);
      stripePendingCents = bal.pending
        .filter((b) => b.currency === "usd")
        .reduce((sum, b) => sum + b.amount, 0);
    } catch {
      balanceError = true;
    }
  }

  const [target, approved, pending] = await Promise.all([
    reserveTargetCents(),
    prisma.affiliateConversion.aggregate({
      _sum: { commissionCents: true },
      where: { status: { in: ["APPROVED", "PENDING"] }, payoutId: null },
    }),
    prisma.affiliateConversion.aggregate({
      _sum: { commissionCents: true },
      where: { status: "PENDING", payoutId: null },
    }),
  ]);
  const approvedOwedCents = approved._sum.commissionCents ?? 0;
  const pendingOwedCents = pending._sum.commissionCents ?? 0;
  const reserveNeededCents = Math.max(target, approvedOwedCents);
  return {
    stripeAvailableCents,
    stripePendingCents,
    balanceError,
    reserveTargetCents: target,
    approvedOwedCents,
    pendingOwedCents,
    reserveNeededCents,
    safeToSweepCents: Math.max(0, stripeAvailableCents - reserveNeededCents),
    reserveShortCents: Math.max(0, reserveNeededCents - stripeAvailableCents),
  };
}
