import "server-only";

import { getCommissionPartnerConfig, saveCommissionPartnerConfig } from "@/lib/commission-config-store";
import { appBaseUrl, getStripe } from "@/lib/stripe";

export type ConnectPartnerStatus = {
  configured: boolean;
  accountId: string | null;
  email: string | null;
  name: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
};

export async function getConnectPartnerStatus(): Promise<ConnectPartnerStatus> {
  const config = await getCommissionPartnerConfig();
  const accountId = config.partnerAccountId;
  if (!accountId) {
    return {
      configured: false,
      accountId: null,
      email: config.partnerEmail,
      name: config.partnerName,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: true,
      accountId,
      email: config.partnerEmail,
      name: config.partnerName,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    return {
      configured: true,
      accountId,
      email: account.email ?? config.partnerEmail,
      name: account.business_profile?.name ?? config.partnerName,
      detailsSubmitted: Boolean(account.details_submitted),
      payoutsEnabled: Boolean(account.payouts_enabled),
      chargesEnabled: Boolean(account.charges_enabled),
    };
  } catch {
    return {
      configured: true,
      accountId,
      email: config.partnerEmail,
      name: config.partnerName,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
    };
  }
}

export async function ensurePartnerConnectAccount(input?: {
  email?: string;
  name?: string;
}): Promise<{ accountId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const existing = await getCommissionPartnerConfig();
  if (existing.partnerAccountId) {
    return { accountId: existing.partnerAccountId };
  }

  const email =
    input?.email?.trim() ||
    existing.partnerEmail ||
    process.env.STRIPE_COMMISSION_PARTNER_EMAIL?.trim();
  if (!email) {
    return { error: "Set STRIPE_COMMISSION_PARTNER_EMAIL before Connect onboarding." };
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email,
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: input?.name
      ? { name: input.name }
      : existing.partnerName
        ? { name: existing.partnerName }
        : undefined,
    metadata: {
      role: "commission_partner",
      product: "train-station",
    },
  });

  await saveCommissionPartnerConfig({
    partnerAccountId: account.id,
    partnerEmail: email,
    partnerName: input?.name ?? existing.partnerName,
  });

  return { accountId: account.id };
}

export async function createPartnerOnboardingLink(): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const ensured = await ensurePartnerConnectAccount();
  if ("error" in ensured) return ensured;

  const base = appBaseUrl();
  const link = await stripe.accountLinks.create({
    account: ensured.accountId,
    refresh_url: `${base}/admin/commission?connect=refresh`,
    return_url: `${base}/admin/commission?connect=return`,
    type: "account_onboarding",
  });

  if (!link.url) return { error: "Stripe did not return an onboarding URL." };
  return { url: link.url };
}

export async function createPartnerDashboardLink(): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const config = await getCommissionPartnerConfig();
  if (!config.partnerAccountId) {
    return { error: "Partner Connect account is not linked yet." };
  }

  const link = await stripe.accounts.createLoginLink(config.partnerAccountId);
  if (!link.url) return { error: "Stripe did not return a dashboard URL." };
  return { url: link.url };
}