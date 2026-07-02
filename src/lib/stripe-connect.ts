import "server-only";

import {
  getCommissionPartner,
  updateCommissionPartner,
  type CommissionPartner,
} from "@/lib/commission-partners-store";
import { appBaseUrl, getStripe } from "@/lib/stripe";

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
        return `${message} Open Stripe Dashboard → Connect → Get started and finish platform setup (profile + branding), then click Connect again.`;
      }
      return message;
    }
  }
  return "Connect onboarding failed.";
}

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

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: partner.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        ...(partner.name ? { name: partner.name } : {}),
        url: appBaseUrl(),
      },
      metadata: {
        role: "commission_partner",
        product: "train-station",
        partner_id: partnerId,
      },
    });

    await updateCommissionPartner(partnerId, { stripeAccountId: account.id });
    return { accountId: account.id };
  } catch (e: unknown) {
    return { error: formatStripeConnectError(e) };
  }
}

export async function createPartnerOnboardingLink(
  partnerId: string,
): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const ensured = await ensurePartnerConnectAccount(partnerId);
  if ("error" in ensured) return ensured;

  const base = appBaseUrl();
  try {
    const link = await stripe.accountLinks.create({
      account: ensured.accountId,
      refresh_url: `${base}/admin/commission?connect=refresh&partnerId=${encodeURIComponent(partnerId)}`,
      return_url: `${base}/admin/commission?connect=return&partnerId=${encodeURIComponent(partnerId)}`,
      type: "account_onboarding",
    });

    if (!link.url) return { error: "Stripe did not return an onboarding URL." };
    return { url: link.url };
  } catch (e: unknown) {
    return { error: formatStripeConnectError(e) };
  }
}

export async function getConnectPlatformHint(): Promise<{
  ready: boolean;
  message: string | null;
}> {
  const stripe = getStripe();
  if (!stripe) {
    return { ready: false, message: "Stripe is not configured on this deployment." };
  }

  try {
    await stripe.accounts.list({ limit: 1 });
    return { ready: true, message: null };
  } catch (e: unknown) {
    return { ready: false, message: formatStripeConnectError(e) };
  }
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