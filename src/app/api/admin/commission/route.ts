import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  splitCommissionAmongPartners,
  splitRevenueAmongPartners,
} from "@/lib/commission-partner-splits";
import { listCommissionPartners, validatePartnerShares } from "@/lib/commission-partners-store";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";
import {
  commissionConfigFromEnv,
  commissionSplitMode,
  fetchActiveMrrCents,
  formatUsdFromCents,
  isCommissionEnabled,
  previousCommissionPeriod,
  revenueSplitFromMrr,
  tieredCommissionFromMrr,
} from "@/lib/stripe-commission";
import { listConnectPartnerStatuses } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [mrr, payouts, partners, connectStatuses] = await Promise.all([
    fetchActiveMrrCents(),
    listCommissionPayouts(),
    listCommissionPartners(),
    listConnectPartnerStatuses(),
  ]);

  const mode = commissionSplitMode();
  const shareCheck = validatePartnerShares(partners, mode);
  const config = commissionConfigFromEnv();
  const flatSplit =
    mode === "flat" ? revenueSplitFromMrr(mrr.mrrCents, shareCheck.shareTotal) : null;
  const tieredBreakdown = mode === "tiered" ? tieredCommissionFromMrr(mrr.mrrCents) : null;
  const projectedSplits = (
    mode === "flat"
      ? splitRevenueAmongPartners(mrr.mrrCents, partners)
      : splitCommissionAmongPartners(tieredBreakdown?.totalCommissionCents ?? 0, partners)
  ).map((line) => ({
    ...line,
    amountLabel: formatUsdFromCents(line.amountCents),
  }));

  const connectById = new Map(connectStatuses.map((s) => [s.partnerId, s]));

  return NextResponse.json({
    enabled: isCommissionEnabled(),
    mode,
    periodSuggested: previousCommissionPeriod(),
    mrr: {
      cents: mrr.mrrCents,
      label: formatUsdFromCents(mrr.mrrCents),
      activeSubscriptions: mrr.activeSubscriptions,
    },
    commission: {
      totalCommissionCents:
        mode === "flat"
          ? (flatSplit?.totalPartnerPayoutCents ?? 0)
          : (tieredBreakdown?.totalCommissionCents ?? 0),
      totalLabel: formatUsdFromCents(
        mode === "flat"
          ? (flatSplit?.totalPartnerPayoutCents ?? 0)
          : (tieredBreakdown?.totalCommissionCents ?? 0),
      ),
      tier1BaseCents: tieredBreakdown?.tier1BaseCents ?? 0,
      tier1CommissionCents: tieredBreakdown?.tier1CommissionCents ?? 0,
      tier2BaseCents: tieredBreakdown?.tier2BaseCents ?? 0,
      tier2CommissionCents: tieredBreakdown?.tier2CommissionCents ?? 0,
      tier1CapLabel: formatUsdFromCents(config.tier1CapCents),
      tier1RatePercent: Math.round(config.tier1Rate * 100),
      tier2RatePercent: Math.round(config.tier2Rate * 100),
    },
    companyFeed:
      mode === "flat" && flatSplit
        ? {
            sharePercent: flatSplit.companyRetainedPercent,
            amountCents: flatSplit.companyRetainedCents,
            amountLabel: formatUsdFromCents(flatSplit.companyRetainedCents),
            label: process.env.STRIPE_COMPANY_FEED_LABEL?.trim() || "Company (platform account)",
          }
        : null,
    partners: partners.map((p) => ({
      ...p,
      connect: connectById.get(p.id) ?? null,
    })),
    shareTotal: shareCheck.shareTotal,
    shareValid: shareCheck.shareValid,
    shareMessage: shareCheck.message,
    projectedSplits,
    payouts,
  });
}