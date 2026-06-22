import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { splitCommissionAmongPartners } from "@/lib/commission-partner-splits";
import { listCommissionPartners, sumEnabledSharePercents } from "@/lib/commission-partners-store";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";
import {
  commissionConfigFromEnv,
  fetchActiveMrrCents,
  formatUsdFromCents,
  isCommissionEnabled,
  previousCommissionPeriod,
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

  const breakdown = tieredCommissionFromMrr(mrr.mrrCents);
  const config = commissionConfigFromEnv();
  const shareTotal = sumEnabledSharePercents(partners);
  const projectedSplits = splitCommissionAmongPartners(
    breakdown.totalCommissionCents,
    partners,
  ).map((line) => ({
    ...line,
    amountLabel: formatUsdFromCents(line.amountCents),
  }));

  const connectById = new Map(connectStatuses.map((s) => [s.partnerId, s]));

  return NextResponse.json({
    enabled: isCommissionEnabled(),
    periodSuggested: previousCommissionPeriod(),
    mrr: {
      cents: mrr.mrrCents,
      label: formatUsdFromCents(mrr.mrrCents),
      activeSubscriptions: mrr.activeSubscriptions,
    },
    commission: {
      ...breakdown,
      totalLabel: formatUsdFromCents(breakdown.totalCommissionCents),
      tier1CapLabel: formatUsdFromCents(config.tier1CapCents),
      tier1RatePercent: Math.round(config.tier1Rate * 100),
      tier2RatePercent: Math.round(config.tier2Rate * 100),
    },
    partners: partners.map((p) => ({
      ...p,
      connect: connectById.get(p.id) ?? null,
    })),
    shareTotal,
    shareValid: shareTotal === 100,
    projectedSplits,
    payouts,
  });
}