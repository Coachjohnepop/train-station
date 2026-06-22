import { NextResponse } from "next/server";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";
import {
  commissionConfigFromEnv,
  fetchActiveMrrCents,
  formatUsdFromCents,
  isCommissionEnabled,
  previousCommissionPeriod,
  tieredCommissionFromMrr,
} from "@/lib/stripe-commission";
import { getConnectPartnerStatus } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [mrr, payouts, partner] = await Promise.all([
    fetchActiveMrrCents(),
    listCommissionPayouts(),
    getConnectPartnerStatus(),
  ]);

  const breakdown = tieredCommissionFromMrr(mrr.mrrCents);
  const config = commissionConfigFromEnv();

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
    partner,
    payouts,
  });
}