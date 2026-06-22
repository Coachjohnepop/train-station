import "server-only";

import { randomUUID } from "crypto";
import { splitCommissionAmongPartners } from "@/lib/commission-partner-splits";
import {
  listEnabledCommissionPartners,
  sumEnabledSharePercents,
} from "@/lib/commission-partners-store";
import {
  getCommissionPayoutForPeriod,
  upsertCommissionPayout,
  type CommissionPayoutRecord,
  type PartnerPayoutLine,
} from "@/lib/commission-ledger-store";
import {
  fetchActiveMrrCents,
  isCommissionEnabled,
  tieredCommissionFromMrr,
} from "@/lib/stripe-commission";
import { getStripe } from "@/lib/stripe";

function payoutStatusFromLines(lines: PartnerPayoutLine[]): CommissionPayoutRecord["status"] {
  if (lines.length === 0) return "failed";
  if (lines.every((l) => l.status === "paid")) return "paid";
  if (lines.some((l) => l.status === "paid")) return "partial";
  if (lines.some((l) => l.status === "failed")) return "failed";
  return "pending";
}

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

  const partners = await listEnabledCommissionPartners();
  if (partners.length === 0) {
    return { error: "No enabled commission partners. Add partners in Admin → Commission." };
  }

  const shareTotal = sumEnabledSharePercents(partners);
  if (shareTotal !== 100) {
    return {
      error: `Enabled partner shares must total 100% (currently ${shareTotal}%). Adjust shares in Commission admin.`,
    };
  }

  const readyPartners = partners.filter((p) => p.stripeAccountId);
  if (readyPartners.length === 0) {
    return { error: "No partners have completed Stripe Connect onboarding." };
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

  const splitLines = splitCommissionAmongPartners(amount, partners);
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  const basePartnerLines: PartnerPayoutLine[] = splitLines.map((line) => {
    const partner = partnerById.get(line.partnerId);
    const canPay = Boolean(partner?.stripeAccountId) && line.amountCents > 0;
    return {
      partnerId: line.partnerId,
      partnerName: line.partnerName,
      sharePercent: line.sharePercent,
      amountCents: line.amountCents,
      transferId: null,
      status: canPay ? "pending" : "skipped",
      error: canPay
        ? null
        : line.amountCents <= 0
          ? "Zero share"
          : "Stripe Connect not linked",
    };
  });

  const baseRecord: CommissionPayoutRecord = {
    id: existing?.id || randomUUID(),
    period,
    mrrCents: breakdown.mrrCents,
    tier1BaseCents: breakdown.tier1BaseCents,
    tier1CommissionCents: breakdown.tier1CommissionCents,
    tier2BaseCents: breakdown.tier2BaseCents,
    tier2CommissionCents: breakdown.tier2CommissionCents,
    totalCommissionCents: amount,
    transferId: null,
    partnerLines: basePartnerLines,
    status: "pending",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    paidAt: null,
    error: null,
  };

  if (input?.dryRun) {
    return { ok: true, dryRun: true, record: baseRecord };
  }

  const paidLines: PartnerPayoutLine[] = [];
  const errors: string[] = [];

  for (const line of basePartnerLines) {
    if (line.status === "skipped" || line.amountCents <= 0) {
      paidLines.push(line);
      continue;
    }

    const partner = partnerById.get(line.partnerId);
    if (!partner?.stripeAccountId) {
      paidLines.push({ ...line, status: "skipped", error: "Stripe Connect not linked" });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: line.amountCents,
        currency: "usd",
        destination: partner.stripeAccountId,
        description: `Train Station commission ${period} — ${partner.name}`,
        metadata: {
          period,
          partner_id: partner.id,
          mrr_cents: String(breakdown.mrrCents),
          share_percent: String(line.sharePercent),
        },
      });
      paidLines.push({
        ...line,
        transferId: transfer.id,
        status: "paid",
        error: null,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Transfer failed";
      errors.push(`${partner.name}: ${message}`);
      paidLines.push({
        ...line,
        status: "failed",
        error: message,
      });
    }
  }

  const status = payoutStatusFromLines(paidLines);
  const record = await upsertCommissionPayout({
    ...baseRecord,
    partnerLines: paidLines,
    transferId: paidLines.find((l) => l.transferId)?.transferId ?? null,
    status,
    paidAt: status === "paid" || status === "partial" ? new Date().toISOString() : null,
    error: errors.length > 0 ? errors.join("; ") : null,
  });

  if (status === "failed") {
    return { error: record.error || "All partner transfers failed." };
  }

  return { ok: true, dryRun: false, record };
}