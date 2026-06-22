import "server-only";

import { randomUUID } from "crypto";
import {
  getCommissionPayoutForPeriod,
  upsertCommissionPayout,
  type CommissionPayoutRecord,
} from "@/lib/commission-ledger-store";
import { resolvePartnerAccountId } from "@/lib/commission-config-store";
import {
  fetchActiveMrrCents,
  isCommissionEnabled,
  tieredCommissionFromMrr,
} from "@/lib/stripe-commission";
import { getStripe } from "@/lib/stripe";

export async function runCommissionPayout(input?: {
  period?: string;
  dryRun?: boolean;
}): Promise<
  | {
      ok: true;
      dryRun: boolean;
      record: CommissionPayoutRecord;
    }
  | { error: string }
> {
  if (!isCommissionEnabled()) {
    return { error: "Commission payouts are disabled (STRIPE_COMMISSION_ENABLED=false)." };
  }

  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured." };

  const partnerAccountId = await resolvePartnerAccountId();
  if (!partnerAccountId) {
    return { error: "Partner Connect account is not linked. Complete onboarding first." };
  }

  const period = input?.period?.trim() || new Date().toISOString().slice(0, 7);
  const existing = await getCommissionPayoutForPeriod(period);
  if (existing?.status === "paid") {
    return { error: `Commission for ${period} was already paid.` };
  }

  const { mrrCents } = await fetchActiveMrrCents();
  const breakdown = tieredCommissionFromMrr(mrrCents);
  const amount = breakdown.totalCommissionCents;

  if (amount <= 0) {
    return { error: "Commission amount is zero — no active MRR to pay against." };
  }

  const baseRecord: CommissionPayoutRecord = {
    id: existing?.id || randomUUID(),
    period,
    mrrCents: breakdown.mrrCents,
    tier1BaseCents: breakdown.tier1BaseCents,
    tier1CommissionCents: breakdown.tier1CommissionCents,
    tier2BaseCents: breakdown.tier2BaseCents,
    tier2CommissionCents: breakdown.tier2CommissionCents,
    totalCommissionCents: amount,
    transferId: existing?.transferId ?? null,
    status: existing?.status ?? "pending",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    paidAt: existing?.paidAt ?? null,
    error: null,
  };

  if (input?.dryRun) {
    return { ok: true, dryRun: true, record: { ...baseRecord, status: "pending" } };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: "usd",
      destination: partnerAccountId,
      description: `Train Station commission ${period} — MRR ${breakdown.mrrCents / 100}`,
      metadata: {
        period,
        mrr_cents: String(breakdown.mrrCents),
        tier1_commission_cents: String(breakdown.tier1CommissionCents),
        tier2_commission_cents: String(breakdown.tier2CommissionCents),
      },
    });

    const paidRecord = await upsertCommissionPayout({
      ...baseRecord,
      transferId: transfer.id,
      status: "paid",
      paidAt: new Date().toISOString(),
      error: null,
    });

    return { ok: true, dryRun: false, record: paidRecord };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transfer failed";
    const failedRecord = await upsertCommissionPayout({
      ...baseRecord,
      status: "failed",
      error: message,
    });
    return { error: `${message} (ledger id ${failedRecord.id})` };
  }
}