import type { Prisma } from "@/generated/prisma/client";
import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-exercises";

export type SubscriptionPaymentFactInput = {
  userId?: string | null;
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  amountCents: number;
  amountRefundedCents?: number;
  currency?: string;
  status: string;
  tierSlug?: string | null;
  planId?: string | null;
  billingReason?: string | null;
  paidAt: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  stripeEventId?: string | null;
  properties?: Record<string, unknown>;
};

export async function recordSubscriptionPaymentFact(
  input: SubscriptionPaymentFactInput,
): Promise<void> {
  if (!isDatabaseConfigured() || isDemoMode()) return;

  const { prisma } = await import("@/lib/prisma");

  if (input.stripeInvoiceId) {
    const existing = await prisma.factSubscriptionPayment.findUnique({
      where: { stripeInvoiceId: input.stripeInvoiceId },
      select: { id: true },
    });
    if (existing) return;
  }

  await prisma.factSubscriptionPayment.create({
    data: {
      userId: input.userId ?? undefined,
      stripeInvoiceId: input.stripeInvoiceId ?? undefined,
      stripePaymentIntentId: input.stripePaymentIntentId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      amountCents: input.amountCents,
      amountRefundedCents: input.amountRefundedCents ?? 0,
      currency: input.currency ?? "usd",
      status: input.status,
      tierSlug: input.tierSlug ?? undefined,
      planId: input.planId ?? undefined,
      billingReason: input.billingReason ?? undefined,
      paidAt: input.paidAt,
      periodStart: input.periodStart ?? undefined,
      periodEnd: input.periodEnd ?? undefined,
      stripeEventId: input.stripeEventId ?? undefined,
      properties: (input.properties ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function recordCommissionPayoutFact(input: {
  partnerId?: string | null;
  partnerEmail?: string | null;
  amountCents: number;
  currency?: string;
  status: string;
  stripeTransferId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt?: Date | null;
  properties?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured() || isDemoMode()) return;

  const { prisma } = await import("@/lib/prisma");
  await prisma.factCommissionPayout.create({
    data: {
      partnerId: input.partnerId ?? undefined,
      partnerEmail: input.partnerEmail ?? undefined,
      amountCents: input.amountCents,
      currency: input.currency ?? "usd",
      status: input.status,
      stripeTransferId: input.stripeTransferId ?? undefined,
      periodStart: input.periodStart ?? undefined,
      periodEnd: input.periodEnd ?? undefined,
      paidAt: input.paidAt ?? undefined,
      properties: (input.properties ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}