import "server-only";

/**
 * Monthly platform admin fee → John (Grok + infra).
 * Separate from the 5%/30% MRR partner pool. Transfer via Stripe Connect Express.
 *
 * Env:
 *   STRIPE_PLATFORM_ADMIN_FEE_DOLLARS=275   (default)
 *   STRIPE_PLATFORM_ADMIN_PARTNER_EMAIL=john@thetrainstation.co  (match partner row)
 */

import { listCommissionPartners } from "@/lib/commission-partners-store";
import { recordCommissionPayoutFact } from "@/lib/analytics-facts";
import { getStripe } from "@/lib/stripe";
import { getConnectPartnerStatus } from "@/lib/stripe-connect";

const DEFAULT_FEE_DOLLARS = 275;
const DEFAULT_PARTNER_EMAIL = "john@thetrainstation.co";

export function platformAdminFeeDollarsFromEnv(): number {
  const raw = process.env.STRIPE_PLATFORM_ADMIN_FEE_DOLLARS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n <= 10_000) return Math.round(n * 100) / 100;
  }
  return DEFAULT_FEE_DOLLARS;
}

export function platformAdminFeeCentsFromEnv(): number {
  return Math.round(platformAdminFeeDollarsFromEnv() * 100);
}

export function platformAdminPartnerEmailFromEnv(): string {
  return (
    process.env.STRIPE_PLATFORM_ADMIN_PARTNER_EMAIL?.trim().toLowerCase() ||
    DEFAULT_PARTNER_EMAIL
  );
}

export function platformAdminPeriod(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `platform-admin-${y}-${m}`;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

export type PlatformAdminFeePreview = {
  period: string;
  amountCents: number;
  amountLabel: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  stripeAccountId: string;
  connectReady: boolean;
  description: string;
};

export async function previewPlatformAdminFee(): Promise<
  PlatformAdminFeePreview | { error: string }
> {
  const amountCents = platformAdminFeeCentsFromEnv();
  const email = platformAdminPartnerEmailFromEnv();
  const partners = await listCommissionPartners();
  const partner =
    partners.find((p) => p.enabled && p.email === email) ||
    partners.find((p) => p.enabled && p.email.includes("john") && p.sharePercent > 0) ||
    partners.find((p) => p.enabled && p.stripeAccountId);

  if (!partner) {
    return {
      error:
        "No payout partner found for platform admin. Add John under Dev & partnership (email match) and complete Connect.",
    };
  }
  if (!partner.stripeAccountId) {
    return {
      error: `${partner.name} has no Stripe Connect account yet — open Connect onboarding first.`,
    };
  }

  const status = await getConnectPartnerStatus(partner.id);
  const connectReady = Boolean(status?.payoutsEnabled && status?.detailsSubmitted);
  const period = platformAdminPeriod();

  return {
    period,
    amountCents,
    amountLabel: formatUsd(amountCents),
    partnerId: partner.id,
    partnerName: partner.name,
    partnerEmail: partner.email,
    stripeAccountId: partner.stripeAccountId,
    connectReady,
    description: `Platform admin (Grok + infra) · ${period}`,
  };
}

export async function runPlatformAdminFee(input?: {
  dryRun?: boolean;
}): Promise<
  | {
      ok: true;
      dryRun: boolean;
      preview: PlatformAdminFeePreview;
      transferId?: string;
    }
  | { error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const preview = await previewPlatformAdminFee();
  if ("error" in preview) return preview;

  if (!preview.connectReady) {
    return {
      error: `${preview.partnerName} Connect is not ready for payouts yet (finish Express bank + identity).`,
    };
  }

  if (input?.dryRun) {
    return { ok: true, dryRun: true, preview };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: preview.amountCents,
      currency: "usd",
      destination: preview.stripeAccountId,
      description: preview.description,
      metadata: {
        kind: "platform_admin_fee",
        period: preview.period,
        partner_id: preview.partnerId,
        partner_email: preview.partnerEmail,
        amount_cents: String(preview.amountCents),
      },
    });

    await recordCommissionPayoutFact({
      partnerId: preview.partnerId,
      partnerEmail: preview.partnerEmail,
      amountCents: preview.amountCents,
      currency: "usd",
      status: "paid",
      stripeTransferId: transfer.id,
      paidAt: new Date(),
      properties: {
        kind: "platform_admin_fee",
        period: preview.period,
        description: preview.description,
      },
    });

    return {
      ok: true,
      dryRun: false,
      preview,
      transferId: transfer.id,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Platform admin transfer failed.";
    return { error: message };
  }
}
