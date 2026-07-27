import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  splitCommissionAmongPartners,
  splitRevenueAmongPartners,
} from "@/lib/commission-partner-splits";
import { listCommissionPartners, validatePartnerShares } from "@/lib/commission-partners-store";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";
import { buildMoneyDeskQueue } from "@/lib/money-desk-queue";
import { previewPlatformAdminFee } from "@/lib/platform-admin-fee";
import {
  commissionConfigFromEnv,
  commissionFromMrr,
  commissionPayoutMinCentsFromEnv,
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
import { getStripe, getStripePublishableKey } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe-price-ids";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

async function fetchStripeBalanceSnapshot(): Promise<{
  configured: boolean;
  testMode: boolean;
  availableCents: number | null;
  availableLabel: string | null;
  pendingCents: number | null;
  pendingLabel: string | null;
  error: string | null;
}> {
  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: false,
      testMode: isStripeTestMode(),
      availableCents: null,
      availableLabel: null,
      pendingCents: null,
      pendingLabel: null,
      error: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
    };
  }
  try {
    const balance = await stripe.balance.retrieve();
    const available =
      balance.available?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? 0;
    const pending =
      balance.pending?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? 0;
    return {
      configured: true,
      testMode: isStripeTestMode(),
      availableCents: available,
      availableLabel: formatUsdFromCents(available),
      pendingCents: pending,
      pendingLabel: formatUsdFromCents(pending),
      error: null,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load Stripe balance.";
    return {
      configured: true,
      testMode: isStripeTestMode(),
      availableCents: null,
      availableLabel: null,
      pendingCents: null,
      pendingLabel: null,
      error: message,
    };
  }
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    mrr,
    payouts,
    partners,
    connectStatuses,
    coachSettings,
    connectPlatform,
    stripeBalance,
    platformAdmin,
  ] = await Promise.all([
    fetchActiveMrrCents(),
    listCommissionPayouts(),
    listCommissionPartners(),
    listConnectPartnerStatuses(),
    getCoachSettings(),
    getConnectPlatformHint(),
    fetchStripeBalanceSnapshot(),
    previewPlatformAdminFee().catch((e: unknown) => ({
      error: e instanceof Error ? e.message : "Platform admin fee preview failed.",
    })),
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
  const partnersWithConnect = partners.map((p) => ({
    ...p,
    connect: connectById.get(p.id) ?? null,
  }));
  const poolTotalCents =
    mode === "flat"
      ? (flatSplit?.totalPartnerPayoutCents ?? 0)
      : (poolBreakdown?.totalCommissionCents ?? 0);
  const payoutMinCents = commissionPayoutMinCentsFromEnv();
  const payoutMinimum = {
    cents: payoutMinCents,
    label: formatUsdFromCents(payoutMinCents),
    met: poolTotalCents >= payoutMinCents,
    shortfallCents: Math.max(0, payoutMinCents - poolTotalCents),
    shortfallLabel: formatUsdFromCents(Math.max(0, payoutMinCents - poolTotalCents)),
  };

  const companyFeed =
    mode === "flat" && flatSplit
      ? {
          sharePercent: flatSplit.companyRetainedPercent,
          amountCents: flatSplit.companyRetainedCents,
          amountLabel: formatUsdFromCents(flatSplit.companyRetainedCents),
          label:
            process.env.STRIPE_COMPANY_FEED_LABEL?.trim() ||
            "The Train Station (Jeremy · master Stripe)",
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
            label:
              process.env.STRIPE_COMPANY_FEED_LABEL?.trim() ||
              "The Train Station (Jeremy · master Stripe)",
          }
        : null;

  const periodSuggested = previousCommissionPeriod();
  const periodRecord = payouts.find((p) => p.period === periodSuggested);
  const periodAlreadyPaid = periodRecord?.status === "paid";
  const periodPartial = periodRecord?.status === "partial";

  const paymentQueue = buildMoneyDeskQueue({
    projectedSplits,
    partners: partnersWithConnect,
    companyFeed,
    payoutMinimum,
    period: periodSuggested,
    periodAlreadyPaid,
    periodPartial,
    mode,
    shareValid: shareCheck.shareValid,
    shareMessage: shareCheck.message,
    platformAdmin,
  });

  return NextResponse.json({
    enabled: isCommissionEnabled(),
    mode,
    periodSuggested,
    payoutMinimum,
    stripeBalance: {
      ...stripeBalance,
      publishableKeyPresent: Boolean(getStripePublishableKey()),
    },
    paymentQueue,
    mrr: {
      cents: mrr.mrrCents,
      label: formatUsdFromCents(mrr.mrrCents),
      activeSubscriptions: mrr.activeSubscriptions,
    },
    commission: {
      totalCommissionCents: poolTotalCents,
      totalLabel: formatUsdFromCents(poolTotalCents),
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
    companyFeed,
    partners: partnersWithConnect,
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