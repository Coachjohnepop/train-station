import "server-only";

import { listMemberProfiles } from "@/lib/member-profiles-store";
import { buildMoneyDeskQueue } from "@/lib/money-desk-queue";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";
import {
  listCommissionPartners,
  validatePartnerShares,
} from "@/lib/commission-partners-store";
import {
  splitCommissionAmongPartners,
  splitRevenueAmongPartners,
} from "@/lib/commission-partner-splits";
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
import { previewPlatformAdminFee } from "@/lib/platform-admin-fee";
import { getBillingAdminOverview } from "@/lib/stripe-billing-admin";
import { getStripe, getStripePublishableKey } from "@/lib/stripe";
import { isStripeTestMode } from "@/lib/stripe-price-ids";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";
import { isDatabaseConfigured } from "@/lib/database-config";
import { COMMISSION_PAYOUT_WEEKDAYS, getCoachSettings } from "@/lib/coach-settings-store";

async function fetchStripeBalanceSnapshot() {
  const stripe = getStripe();
  if (!stripe) {
    return {
      configured: false as const,
      testMode: isStripeTestMode(),
      availableCents: null as number | null,
      availableLabel: null as string | null,
      pendingCents: null as number | null,
      pendingLabel: null as string | null,
      error: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
      publishableKeyPresent: Boolean(getStripePublishableKey()),
    };
  }
  try {
    const balance = await stripe.balance.retrieve();
    const available =
      balance.available?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? 0;
    const pending =
      balance.pending?.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) ?? 0;
    return {
      configured: true as const,
      testMode: isStripeTestMode(),
      availableCents: available,
      availableLabel: formatUsdFromCents(available),
      pendingCents: pending,
      pendingLabel: formatUsdFromCents(pending),
      error: null as string | null,
      publishableKeyPresent: Boolean(getStripePublishableKey()),
    };
  } catch (e: unknown) {
    return {
      configured: true as const,
      testMode: isStripeTestMode(),
      availableCents: null as number | null,
      availableLabel: null as string | null,
      pendingCents: null as number | null,
      pendingLabel: null as string | null,
      error: e instanceof Error ? e.message : "Could not load Stripe balance.",
      publishableKeyPresent: Boolean(getStripePublishableKey()),
    };
  }
}

async function memberMoneyStats() {
  const profiles = await listMemberProfiles().catch(() => []);
  let paying = 0;
  let pendingPayment = 0;
  let freeExplorer = 0;
  let staffGrant = 0;
  let unpaidOnboarded = 0;
  const byPlan: Record<string, number> = {};

  for (const p of profiles) {
    const plan = p.plan || "unknown";
    byPlan[plan] = (byPlan[plan] || 0) + 1;

    if (p.paymentMethod === "manual" && (p.staffGrantedAt || p.staffGrantExpiresAt)) {
      staffGrant += 1;
    }
    if (p.paymentStatus === "paid") {
      paying += 1;
    } else if (p.paymentStatus === "pending" || p.paymentStatus === "failed") {
      pendingPayment += 1;
      if (p.onboardingComplete) unpaidOnboarded += 1;
    } else if (plan === "explorer" || p.paymentStatus === "none") {
      freeExplorer += 1;
    }
  }

  let activeMemberUsers = profiles.length;
  if (isDatabaseConfigured() && !isDemoMode()) {
    try {
      activeMemberUsers = await prisma.user.count({
        where: { role: "MEMBER", status: "active", hidden: false },
      });
    } catch {
      /* keep profiles length */
    }
  }

  return {
    totalProfiles: profiles.length,
    activeMemberUsers,
    payingMembers: paying,
    pendingPayment,
    freeExplorer,
    staffGrants: staffGrant,
    unpaidButOnboarded: unpaidOnboarded,
    byPlan,
  };
}

/**
 * Accounting desk snapshot: Stripe balance, payout minimums, projected splits,
 * paying members, and revenue KPIs. Composes billing + commission sources.
 */
export async function getAccountingDashboard() {
  const [
    billing,
    stripeBalance,
    mrr,
    partners,
    payouts,
    connectStatuses,
    connectPlatform,
    platformAdmin,
    members,
    coachSettings,
  ] = await Promise.all([
    getBillingAdminOverview().catch((e: unknown) => ({
      configured: false as const,
      testMode: isStripeTestMode(),
      publishableKeyPresent: Boolean(getStripePublishableKey()),
      message: e instanceof Error ? e.message : "Billing overview failed",
    })),
    fetchStripeBalanceSnapshot(),
    fetchActiveMrrCents(),
    listCommissionPartners(),
    listCommissionPayouts(),
    listConnectPartnerStatuses(),
    getConnectPlatformHint(),
    previewPlatformAdminFee().catch((e: unknown) => ({
      error: e instanceof Error ? e.message : "Platform admin fee preview failed.",
    })),
    memberMoneyStats(),
    getCoachSettings(),
  ]);

  const mode = commissionSplitMode();
  const shareCheck = validatePartnerShares(partners, mode);
  const config = commissionConfigFromEnv();
  const enabled = isCommissionEnabled();

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
    poolCents: poolTotalCents,
    poolLabel: formatUsdFromCents(poolTotalCents),
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

  return {
    generatedAt: new Date().toISOString(),
    testMode: isStripeTestMode(),
    commissionEnabled: enabled,
    stripeBalance,
    volume:
      billing && "volume" in billing && billing.volume
        ? billing.volume
        : {
            gross30Cents: 0,
            gross30Label: "—",
            refunded30Cents: 0,
            refunded30Label: "—",
            net30Cents: 0,
            net30Label: "—",
            gross7Cents: 0,
            gross7Label: "—",
          },
    mrr: {
      cents: mrr.mrrCents,
      label: formatUsdFromCents(mrr.mrrCents),
      activeSubscriptions: mrr.activeSubscriptions,
    },
    members,
    payoutMinimum,
    projectedSplits,
    companyFeed,
    paymentQueue,
    recentPayouts: (payouts || []).slice(0, 8).map((p) => ({
      period: p.period,
      status: p.status,
      totalLabel: formatUsdFromCents(p.totalCommissionCents),
      mrrLabel: formatUsdFromCents(p.mrrCents),
      paidAt: p.paidAt,
      error: p.error,
    })),
    connectPlatform,
    platformAdmin:
      platformAdmin && typeof platformAdmin === "object" && "error" in platformAdmin
        ? { error: String((platformAdmin as { error: string }).error) }
        : platformAdmin,
    partnerShare: {
      mode,
      shareTotal: shareCheck.shareTotal,
      shareValid: shareCheck.shareValid,
      shareMessage: shareCheck.message,
      periodSuggested,
      tier1CapLabel: formatUsdFromCents(config.tier1CapCents),
    },
    payoutSchedule: {
      mode: coachSettings.commissionPayoutMode,
      weekday: coachSettings.commissionPayoutWeekday,
      weekdayLabel:
        COMMISSION_PAYOUT_WEEKDAYS.find((d) => d.value === coachSettings.commissionPayoutWeekday)
          ?.label ?? "Friday",
    },
    links: {
      moneyDesk: "/admin/billing?tab=share",
      billing: "/admin/billing",
      discounts: "/admin/discounts",
      members: "/admin/members",
    },
  };
}
