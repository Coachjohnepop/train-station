import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getStripe } from "@/lib/stripe";
import { MINIMUM_PAYOUT_CENTS } from "@/lib/affiliate/commission";

const PAYABLE = ["PENDING", "APPROVED"] as const;

function formatStripeConnectError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: string; raw?: { message?: string } };
    const message = err.message || err.raw?.message;
    if (message) {
      const lower = message.toLowerCase();
      if (
        lower.includes("connect") &&
        (lower.includes("not enabled") ||
          lower.includes("signed up") ||
          lower.includes("complete your platform profile"))
      ) {
        return `${message} Open Stripe Dashboard → Connect → Get started and finish platform setup, then try Connect again.`;
      }
      return message;
    }
  }
  return "Stripe Connect failed.";
}

function transfersReady(account: Stripe.Account): boolean {
  const capability = account.capabilities?.transfers;
  return Boolean(account.payouts_enabled) || capability === "active";
}

async function rememberStripeAccount(affiliateId: string, account: Stripe.Account) {
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      stripeAccountId: account.id,
      stripeOnboarded: transfersReady(account),
    },
  });
}

/** Called from the Stripe webhook when a connected account changes. */
export async function syncAffiliateStripeAccount(account: Stripe.Account): Promise<void> {
  const fromMeta = account.metadata?.affiliate_id?.trim();
  const affiliate = await prisma.affiliate.findFirst({
    where: fromMeta
      ? { OR: [{ stripeAccountId: account.id }, { id: fromMeta }] }
      : { stripeAccountId: account.id },
    select: { id: true },
  });
  if (!affiliate) return;
  if (account.metadata?.role && account.metadata.role !== "affiliate") return;
  await rememberStripeAccount(affiliate.id, account);
}

export async function createAffiliateConnectLink(affiliateId: string): Promise<
  { url: string; accountId: string; onboarded: boolean } | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) return { error: "Affiliate not found." };
  if (affiliate.status === "TERMINATED") {
    return { error: "This affiliate account is closed." };
  }

  try {
    let accountId = affiliate.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: affiliate.email,
        capabilities: { transfers: { requested: true } },
        business_profile: {
          name: affiliate.name,
          url: appBaseUrl(),
          product_description: "The Train Station affiliate commissions",
        },
        metadata: {
          role: "affiliate",
          product: "train-station",
          affiliate_id: affiliate.id,
          referral_code: affiliate.referralCode,
        },
      });
      accountId = account.id;
      await rememberStripeAccount(affiliate.id, account);
    }

    const account = await stripe.accounts.retrieve(accountId);
    await rememberStripeAccount(affiliate.id, account);
    if (transfersReady(account)) {
      const login = await stripe.accounts.createLoginLink(accountId);
      if (!login.url) return { error: "Stripe did not return a dashboard link." };
      return { url: login.url, accountId, onboarded: true };
    }

    const base = appBaseUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/affiliate?stripe=refresh`,
      return_url: `${base}/affiliate?stripe=return`,
    });
    if (!link.url) return { error: "Stripe did not return an onboarding link." };
    return { url: link.url, accountId, onboarded: false };
  } catch (e: unknown) {
    return { error: formatStripeConnectError(e) };
  }
}

export async function affiliateStripeStatus(affiliateId: string): Promise<{
  hasAccount: boolean;
  stripeOnboarded: boolean;
  accountId: string | null;
}> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { stripeAccountId: true, stripeOnboarded: true },
  });
  if (!affiliate?.stripeAccountId) {
    return { hasAccount: false, stripeOnboarded: false, accountId: null };
  }
  const stripe = getStripe();
  if (!stripe) {
    return {
      hasAccount: true,
      stripeOnboarded: affiliate.stripeOnboarded,
      accountId: affiliate.stripeAccountId,
    };
  }
  try {
    const account = await stripe.accounts.retrieve(affiliate.stripeAccountId);
    await rememberStripeAccount(affiliateId, account);
    return {
      hasAccount: true,
      stripeOnboarded: transfersReady(account),
      accountId: account.id,
    };
  } catch {
    return {
      hasAccount: true,
      stripeOnboarded: affiliate.stripeOnboarded,
      accountId: affiliate.stripeAccountId,
    };
  }
}

/**
 * Transfer unpaid commission to the affiliate's Connect account.
 * Staff can waive the $50 floor. A failed transfer leaves the balance payable.
 */
export async function processAffiliatePayout(
  affiliateId: string,
  options: { ignoreMinimum?: boolean } = {},
): Promise<{ ok: true; payoutId: string; amountCents: number; transferId: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) return { ok: false, error: "Affiliate not found." };
  if (affiliate.status !== "ACTIVE") {
    return { ok: false, error: "Approve the affiliate before paying them." };
  }
  if (!affiliate.stripeAccountId) {
    return { ok: false, error: "This affiliate has not connected Stripe." };
  }

  let ready = affiliate.stripeOnboarded;
  try {
    const account = await stripe.accounts.retrieve(affiliate.stripeAccountId);
    ready = transfersReady(account);
    await rememberStripeAccount(affiliate.id, account);
  } catch (e: unknown) {
    return { ok: false, error: formatStripeConnectError(e) };
  }
  if (!ready) {
    return { ok: false, error: "Stripe is still finishing this affiliate's account." };
  }

  const payout = await prisma.affiliatePayout.create({
    data: { affiliateId: affiliate.id, amountCents: 0, status: "PROCESSING" },
  });
  await prisma.affiliateConversion.updateMany({
    where: { affiliateId: affiliate.id, status: { in: [...PAYABLE] }, payoutId: null },
    data: { payoutId: payout.id },
  });
  const claimed = await prisma.affiliateConversion.findMany({
    where: { payoutId: payout.id },
    select: { commissionCents: true },
  });
  const amountCents = claimed.reduce((sum, row) => sum + row.commissionCents, 0);
  if (amountCents <= 0 || (!options.ignoreMinimum && amountCents < MINIMUM_PAYOUT_CENTS)) {
    await prisma.affiliateConversion.updateMany({
      where: { payoutId: payout.id },
      data: { payoutId: null },
    });
    await prisma.affiliatePayout.update({
      where: { id: payout.id },
      data: {
        status: "FAILED",
        amountCents,
        processedAt: new Date(),
        note: amountCents <= 0 ? "No unpaid commission." : "Balance must be at least $50.",
      },
    });
    return {
      ok: false,
      error: amountCents <= 0 ? "No unpaid commission." : "Balance must be at least $50.",
    };
  }
  await prisma.affiliatePayout.update({
    where: { id: payout.id },
    data: { amountCents },
  });

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: "usd",
        destination: affiliate.stripeAccountId,
        description: `The Train Station affiliate payout ${affiliate.referralCode}`,
        metadata: {
          role: "affiliate_payout",
          product: "train-station",
          payoutId: payout.id,
          affiliateId: affiliate.id,
          referralCode: affiliate.referralCode,
        },
      },
      { idempotencyKey: `affiliate-payout-${payout.id}` },
    );

    await prisma.$transaction(async (tx) => {
      await tx.affiliatePayout.update({
        where: { id: payout.id },
        data: {
          status: "COMPLETED",
          stripeTransferId: transfer.id,
          processedAt: new Date(),
        },
      });
      await tx.affiliateConversion.updateMany({
        where: { payoutId: payout.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      const remaining = await tx.affiliateConversion.aggregate({
        where: { affiliateId: affiliate.id, status: { in: [...PAYABLE] }, payoutId: null },
        _sum: { commissionCents: true },
      });
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data: { pendingBalanceCents: remaining._sum.commissionCents ?? 0 },
      });
    });

    return { ok: true, payoutId: payout.id, amountCents, transferId: transfer.id };
  } catch (e: unknown) {
    const message = formatStripeConnectError(e);
    await prisma.$transaction(async (tx) => {
      await tx.affiliatePayout.update({
        where: { id: payout.id },
        data: { status: "FAILED", note: message, processedAt: new Date() },
      });
      await tx.affiliateConversion.updateMany({
        where: { payoutId: payout.id, status: { in: [...PAYABLE] } },
        data: { payoutId: null },
      });
      const remaining = await tx.affiliateConversion.aggregate({
        where: { affiliateId: affiliate.id, status: { in: [...PAYABLE] }, payoutId: null },
        _sum: { commissionCents: true },
      });
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data: { pendingBalanceCents: remaining._sum.commissionCents ?? 0 },
      });
    });
    return { ok: false, error: message };
  }
}

export async function requestAffiliatePayout(affiliateId: string) {
  return processAffiliatePayout(affiliateId);
}
