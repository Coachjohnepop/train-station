import "server-only";

import {
  getCommissionPartner,
  updateCommissionPartner,
  type CommissionPartner,
} from "@/lib/commission-partners-store";
import { appBaseUrl, getStripe } from "@/lib/stripe";

export type ConnectPartnerStatus = {
  partnerId: string;
  configured: boolean;
  accountId: string | null;
  email: string | null;
  name: string | null;
  sharePercent: number;
  enabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
};

async function stripeAccountStatus(
  partner: CommissionPartner,
): Promise<ConnectPartnerStatus> {
  const base: ConnectPartnerStatus = {
    partnerId: partner.id,
    configured: Boolean(partner.stripeAccountId),
    accountId: partner.stripeAccountId,
    email: partner.email,
    name: partner.name,
    sharePercent: partner.sharePercent,
    enabled: partner.enabled,
    detailsSubmitted: false,
    payoutsEnabled: false,
    chargesEnabled: false,
  };

  if (!partner.stripeAccountId) return base;

  const stripe = getStripe();
  if (!stripe) return base;

  try {
    const account = await stripe.accounts.retrieve(partner.stripeAccountId);
    return {
      ...base,
      email: account.email ?? partner.email,
      name: account.business_profile?.name ?? partner.name,
      detailsSubmitted: Boolean(account.details_submitted),
      payoutsEnabled: Boolean(account.payouts_enabled),
      chargesEnabled: Boolean(account.charges_enabled),
    };
  } catch {
    return base;
  }
}

export async function getConnectPartnerStatus(partnerId: string): Promise<ConnectPartnerStatus | null> {
  const partner = await getCommissionPartner(partnerId);
  if (!partner) return null;
  return stripeAccountStatus(partner);
}

export async function listConnectPartnerStatuses(): Promise<ConnectPartnerStatus[]> {
  const { listCommissionPartners } = await import("@/lib/commission-partners-store");
  const partners = await listCommissionPartners();
  return Promise.all(partners.map((p) => stripeAccountStatus(p)));
}

export async function ensurePartnerConnectAccount(
  partnerId: string,
): Promise<{ accountId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const partner = await getCommissionPartner(partnerId);
  if (!partner) return { error: "Partner not found." };

  if (partner.stripeAccountId) {
    return { accountId: partner.stripeAccountId };
  }

  if (!partner.email) {
    return { error: "Partner email is required before Connect onboarding." };
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: partner.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: partner.name ? { name: partner.name } : undefined,
    metadata: {
      role: "commission_partner",
      product: "train-station",
      partner_id: partnerId,
    },
  });

  await updateCommissionPartner(partnerId, { stripeAccountId: account.id });
  return { accountId: account.id };
}

export async function createPartnerOnboardingLink(
  partnerId: string,
): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const ensured = await ensurePartnerConnectAccount(partnerId);
  if ("error" in ensured) return ensured;

  const base = appBaseUrl();
  const link = await stripe.accountLinks.create({
    account: ensured.accountId,
    refresh_url: `${base}/admin/commission?connect=refresh&partnerId=${encodeURIComponent(partnerId)}`,
    return_url: `${base}/admin/commission?connect=return&partnerId=${encodeURIComponent(partnerId)}`,
    type: "account_onboarding",
  });

  if (!link.url) return { error: "Stripe did not return an onboarding URL." };
  return { url: link.url };
}

export async function createPartnerDashboardLink(
  partnerId: string,
): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const partner = await getCommissionPartner(partnerId);
  if (!partner?.stripeAccountId) {
    return { error: "Partner Connect account is not linked yet." };
  }

  const link = await stripe.accounts.createLoginLink(partner.stripeAccountId);
  if (!link.url) return { error: "Stripe did not return a dashboard URL." };
  return { url: link.url };
}