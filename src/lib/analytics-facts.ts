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

function paymentIntentIdFromUnknown(pi: unknown): string | null {
  if (typeof pi === "string" && pi) return pi;
  if (pi && typeof pi === "object" && "id" in pi) {
    const id = (pi as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * Durable money ledger row (Postgres). Used by Admin Billing / Account / M&A.
 * Dedupes on invoice id, payment intent, or checkoutSessionId in properties.
 */
export async function recordSubscriptionPaymentFact(
  input: SubscriptionPaymentFactInput,
): Promise<{ id: string } | null> {
  if (!isDatabaseConfigured() || isDemoMode()) return null;

  try {
    const { prisma } = await import("@/lib/prisma");

    if (input.stripeInvoiceId) {
      const existing = await prisma.factSubscriptionPayment.findUnique({
        where: { stripeInvoiceId: input.stripeInvoiceId },
        select: { id: true },
      });
      if (existing) return existing;
    }

    if (input.stripePaymentIntentId) {
      const existing = await prisma.factSubscriptionPayment.findFirst({
        where: { stripePaymentIntentId: input.stripePaymentIntentId },
        select: { id: true },
      });
      if (existing) return existing;
    }

    const checkoutSessionId =
      typeof input.properties?.checkoutSessionId === "string"
        ? input.properties.checkoutSessionId
        : null;
    if (checkoutSessionId) {
      const existing = await prisma.factSubscriptionPayment.findFirst({
        where: {
          properties: {
            path: ["checkoutSessionId"],
            equals: checkoutSessionId,
          },
        },
        select: { id: true },
      });
      if (existing) return existing;
    }

    // Avoid double-counting: invoice.paid often follows checkout.session.completed
    // with the same subscription + amount within a day (checkout fact has no invoice id yet).
    if (
      input.stripeSubscriptionId &&
      input.status === "paid" &&
      input.amountCents > 0 &&
      input.stripeInvoiceId
    ) {
      const dayAgo = new Date(input.paidAt.getTime() - 24 * 60 * 60 * 1000);
      const dayAhead = new Date(input.paidAt.getTime() + 24 * 60 * 60 * 1000);
      const prior = await prisma.factSubscriptionPayment.findFirst({
        where: {
          stripeSubscriptionId: input.stripeSubscriptionId,
          amountCents: input.amountCents,
          status: "paid",
          stripeInvoiceId: null,
          paidAt: { gte: dayAgo, lte: dayAhead },
        },
        select: { id: true },
      });
      if (prior) {
        const updated = await prisma.factSubscriptionPayment.update({
          where: { id: prior.id },
          data: {
            stripeInvoiceId: input.stripeInvoiceId,
            stripePaymentIntentId:
              input.stripePaymentIntentId ?? undefined,
            stripeEventId: input.stripeEventId ?? undefined,
            billingReason: input.billingReason ?? undefined,
            periodStart: input.periodStart ?? undefined,
            periodEnd: input.periodEnd ?? undefined,
            userId: input.userId ?? undefined,
          },
          select: { id: true },
        });
        return updated;
      }
    }

    const row = await prisma.factSubscriptionPayment.create({
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
      select: { id: true },
    });
    return row;
  } catch (e: unknown) {
    console.error(
      "[analytics-facts] recordSubscriptionPaymentFact failed:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Latest successful payment for a member (Account / membership snapshot). */
export async function getLatestPaidPaymentFact(userId: string): Promise<{
  amountCents: number;
  currency: string;
  paidAt: Date;
  planId: string | null;
  billingReason: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  properties: unknown;
} | null> {
  if (!isDatabaseConfigured() || isDemoMode()) return null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.factSubscriptionPayment.findFirst({
      where: { userId, status: "paid", amountCents: { gt: 0 } },
      orderBy: { paidAt: "desc" },
      select: {
        amountCents: true,
        currency: true,
        paidAt: true,
        planId: true,
        billingReason: true,
        stripeInvoiceId: true,
        stripePaymentIntentId: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        properties: true,
      },
    });
    return row;
  } catch {
    return null;
  }
}

export { paymentIntentIdFromUnknown };

export type PaymentLedgerRow = {
  id: string;
  userId: string | null;
  amountCents: number;
  amountRefundedCents: number;
  currency: string;
  status: string;
  planId: string | null;
  billingReason: string | null;
  paidAt: Date;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  properties: unknown;
  memberName?: string | null;
  memberEmail?: string | null;
};

function formatUsdFromCentsLocal(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/** App ledger of membership / tip payments (Postgres). */
export async function listPaymentLedger(options?: {
  userId?: string;
  limit?: number;
  status?: string;
}): Promise<{
  rows: Array<
    PaymentLedgerRow & {
      amountLabel: string;
      paidAtLabel: string;
    }
  >;
  totalPaidCents: number;
  totalPaidLabel: string;
  count: number;
}> {
  const empty = {
    rows: [] as Array<PaymentLedgerRow & { amountLabel: string; paidAtLabel: string }>,
    totalPaidCents: 0,
    totalPaidLabel: formatUsdFromCentsLocal(0),
    count: 0,
  };
  if (!isDatabaseConfigured() || isDemoMode()) return empty;

  try {
    const { prisma } = await import("@/lib/prisma");
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const where: {
      userId?: string;
      status?: string;
    } = {};
    if (options?.userId) where.userId = options.userId;
    if (options?.status) where.status = options.status;

    const rows = await prisma.factSubscriptionPayment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const mapped = rows.map((r) => {
      const amountLabel = formatUsdFromCentsLocal(r.amountCents, r.currency);
      return {
        id: r.id,
        userId: r.userId,
        amountCents: r.amountCents,
        amountRefundedCents: r.amountRefundedCents,
        currency: r.currency,
        status: r.status,
        planId: r.planId,
        billingReason: r.billingReason,
        paidAt: r.paidAt,
        stripeInvoiceId: r.stripeInvoiceId,
        stripePaymentIntentId: r.stripePaymentIntentId,
        stripeSubscriptionId: r.stripeSubscriptionId,
        stripeCustomerId: r.stripeCustomerId,
        properties: r.properties,
        memberName: r.user?.name ?? null,
        memberEmail: r.user?.email ?? null,
        amountLabel,
        paidAtLabel: r.paidAt.toISOString(),
      };
    });

    const totalPaidCents = mapped
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.amountCents - (r.amountRefundedCents || 0), 0);

    return {
      rows: mapped,
      totalPaidCents,
      totalPaidLabel: formatUsdFromCentsLocal(totalPaidCents),
      count: mapped.length,
    };
  } catch (e: unknown) {
    console.error(
      "[analytics-facts] listPaymentLedger failed:",
      e instanceof Error ? e.message : e,
    );
    return empty;
  }
}

/** Latest paid amount per userId (for admin members list). */
export async function getLatestPaidAmountsByUserIds(
  userIds: string[],
): Promise<Map<string, { amountCents: number; currency: string; paidAt: Date }>> {
  const map = new Map<string, { amountCents: number; currency: string; paidAt: Date }>();
  if (!userIds.length || !isDatabaseConfigured() || isDemoMode()) return map;

  try {
    const { prisma } = await import("@/lib/prisma");
    // One query: recent paid rows, keep first per user
    const rows = await prisma.factSubscriptionPayment.findMany({
      where: {
        userId: { in: userIds },
        status: "paid",
        amountCents: { gt: 0 },
      },
      orderBy: { paidAt: "desc" },
      select: {
        userId: true,
        amountCents: true,
        currency: true,
        paidAt: true,
      },
      take: Math.min(userIds.length * 5, 500),
    });
    for (const r of rows) {
      if (!r.userId || map.has(r.userId)) continue;
      map.set(r.userId, {
        amountCents: r.amountCents,
        currency: r.currency,
        paidAt: r.paidAt,
      });
    }
  } catch {
    /* ignore */
  }
  return map;
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