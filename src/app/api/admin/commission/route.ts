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
  commissionFromMrr,
  commissionSplitMode,
  commissionUsesPoolSplit,
  fetchActiveMrrCents,
  formatUsdFromCents,
  isCommissionEnabled,
  previousCommissionPeriod,
  revenueSplitFromMrr,
} from "@/lib/stripe-commission";
import { getConnectPlatformHint, listConnectPartnerStatuses } from "@/lib/stripe-connect";
import { COMMISSION_PAYOUT_WEEKDAYS, getCoachSettings } from "@/lib/coach-settings-store";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [mrr, payouts, partners, connectStatuses, coachSettings, connectPlatform] =
    await Promise.all([
      fetchActiveMrrCents(),
      listCommissionPayouts(),
      listCommissionPartners(),
      listConnectPartnerStatuses(),
      getCoachSettings(),
      getConnectPlatformHint(),
    ]);

  const mode = commissionSplitMode();
  const shareCheck = validatePartnerShares(partners, mode);
  const config = commissionConfigFromEnv();
  const flatSplit =
    mode === "flat" ? revenueSplitFromMrr(mrr.mrrCents, shareCheck.shareTotal) : null;
  const poolBreakdown = commissionUsesPoolSplit(mode)
    ? commissionFromMrr(mrr.mrrCents, mode)
    : null;
  const projectedSplits = (
    mode === "flat"
      ? splitRevenueAmongPartners(mrr.mrrCents, partners)
      : splitCommissionAmongPartners(poolBreakdown?.totalCommissionCents ?? 0, partners)
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
          : (poolBreakdown?.totalCommissionCents ?? 0),
      totalLabel: formatUsdFromCents(
        mode === "flat"
          ? (flatSplit?.totalPartnerPayoutCents ?? 0)
          : (poolBreakdown?.totalCommissionCents ?? 0),
      ),
      tier1BaseCents: poolBreakdown?.tier1BaseCents ?? 0,
      tier1CommissionCents: poolBreakdown?.tier1CommissionCents ?? 0,
      tier2BaseCents: poolBreakdown?.tier2BaseCents ?? 0,
      tier2CommissionCents: poolBreakdown?.tier2CommissionCents ?? 0,
      tier1CapLabel: formatUsdFromCents(config.tier1CapCents),
      tier1CapCents: config.tier1CapCents,
      tier1RatePercent: Math.round(config.tier1Rate * 100),
      tier2RatePercent: Math.round(config.tier2Rate * 100),
      atOrAboveGoal:
        mode === "milestone" ? mrr.mrrCents >= config.tier1CapCents : undefined,
      activeRatePercent:
        mode === "milestone"
          ? Math.round(
              (mrr.mrrCents >= config.tier1CapCents ? config.tier2Rate : config.tier1Rate) * 100,
            )
          : undefined,
    },
    companyFeed:
      mode === "flat" && flatSplit
        ? {
            sharePercent: flatSplit.companyRetainedPercent,
            amountCents: flatSplit.companyRetainedCents,
            amountLabel: formatUsdFromCents(flatSplit.companyRetainedCents),
            label: process.env.STRIPE_COMPANY_FEED_LABEL?.trim() || "Company (platform account)",
          }
        : poolBreakdown
          ? {
              sharePercent:
                poolBreakdown.mrrCents > 0
                  ? Math.round(
                      ((poolBreakdown.mrrCents - poolBreakdown.totalCommissionCents) /
                        poolBreakdown.mrrCents) *
                        100,
                    )
                  : 0,
              amountCents: Math.max(
                0,
                poolBreakdown.mrrCents - poolBreakdown.totalCommissionCents,
              ),
              amountLabel: formatUsdFromCents(
                Math.max(0, poolBreakdown.mrrCents - poolBreakdown.totalCommissionCents),
              ),
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
    payoutSchedule: {
      mode: coachSettings.commissionPayoutMode,
      weekday: coachSettings.commissionPayoutWeekday,
      weekdayLabel:
        COMMISSION_PAYOUT_WEEKDAYS.find((d) => d.value === coachSettings.commissionPayoutWeekday)
          ?.label ?? "Friday",
    },
    connectPlatform,
  });
}