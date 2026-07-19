import "server-only";

import { getStripe } from "@/lib/stripe";

export type CommissionSplitMode = "flat" | "tiered" | "milestone";

/** Pool-based modes split partner shares across a computed commission pool (must total 100%). */
export function commissionUsesPoolSplit(mode: CommissionSplitMode): boolean {
  return mode === "tiered" || mode === "milestone";
}

export type CommissionTierConfig = {
  tier1CapCents: number;
  tier1Rate: number;
  tier2Rate: number;
};

export type RevenueSplitBreakdown = {
  mrrCents: number;
  partnerShareTotalPercent: number;
  companyRetainedPercent: number;
  companyRetainedCents: number;
  totalPartnerPayoutCents: number;
  mode: CommissionSplitMode;
};

export type CommissionBreakdown = {
  mrrCents: number;
  tier1BaseCents: number;
  tier1CommissionCents: number;
  tier2BaseCents: number;
  tier2CommissionCents: number;
  totalCommissionCents: number;
  config: CommissionTierConfig;
};

export function commissionSplitMode(): CommissionSplitMode {
  const raw = process.env.STRIPE_COMMISSION_MODE?.trim().toLowerCase();
  if (raw === "flat") return "flat";
  if (raw === "tiered") return "tiered";
  return "milestone";
}

export function commissionConfigFromEnv(): CommissionTierConfig {
  const capDollars = Number(process.env.STRIPE_COMMISSION_TIER1_CAP_DOLLARS ?? "5000");
  const tier1CapCents =
    Number(process.env.STRIPE_COMMISSION_TIER1_CAP_CENTS) ||
    Math.round((Number.isFinite(capDollars) ? capDollars : 5000) * 100);

  const tier1Rate = Number(process.env.STRIPE_COMMISSION_TIER1_RATE ?? "0.05");
  const tier2Rate = Number(process.env.STRIPE_COMMISSION_TIER2_RATE ?? "0.30");

  return {
    tier1CapCents,
    tier1Rate: Number.isFinite(tier1Rate) ? tier1Rate : 0.05,
    tier2Rate: Number.isFinite(tier2Rate) ? tier2Rate : 0.3,
  };
}

export function isCommissionEnabled(): boolean {
  return process.env.STRIPE_COMMISSION_ENABLED !== "false";
}

/**
 * Minimum partner-pool total before Connect transfers run.
 * Covers platform / admin costs so we don't pay out tiny amounts.
 * Default $400 — override with STRIPE_COMMISSION_PAYOUT_MIN_DOLLARS or _CENTS.
 */
export function commissionPayoutMinCentsFromEnv(): number {
  const centsRaw = process.env.STRIPE_COMMISSION_PAYOUT_MIN_CENTS?.trim();
  if (centsRaw) {
    const n = Number(centsRaw);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  const dollars = Number(process.env.STRIPE_COMMISSION_PAYOUT_MIN_DOLLARS ?? "400");
  return Math.round((Number.isFinite(dollars) ? Math.max(0, dollars) : 400) * 100);
}

/** Flat mode: partner sharePercents are % of gross MRR; remainder stays on the platform account. */
export function revenueSplitFromMrr(
  mrrCents: number,
  partnerShareTotalPercent: number,
): RevenueSplitBreakdown {
  const safeMrr = Math.max(0, Math.round(mrrCents));
  const shareTotal = Math.max(0, Math.min(100, partnerShareTotalPercent));
  const companyRetainedPercent = Math.max(0, 100 - shareTotal);
  const totalPartnerPayoutCents = Math.round((safeMrr * shareTotal) / 100);
  const companyRetainedCents = safeMrr - totalPartnerPayoutCents;

  return {
    mrrCents: safeMrr,
    partnerShareTotalPercent: shareTotal,
    companyRetainedPercent,
    companyRetainedCents: Math.max(0, companyRetainedCents),
    totalPartnerPayoutCents,
    mode: "flat",
  };
}

export function tieredCommissionFromMrr(
  mrrCents: number,
  config: CommissionTierConfig = commissionConfigFromEnv(),
): CommissionBreakdown {
  const safeMrr = Math.max(0, Math.round(mrrCents));
  const tier1BaseCents = Math.min(safeMrr, config.tier1CapCents);
  const tier2BaseCents = Math.max(0, safeMrr - config.tier1CapCents);
  const tier1CommissionCents = Math.round(tier1BaseCents * config.tier1Rate);
  const tier2CommissionCents = Math.round(tier2BaseCents * config.tier2Rate);

  return {
    mrrCents: safeMrr,
    tier1BaseCents,
    tier1CommissionCents,
    tier2BaseCents,
    tier2CommissionCents,
    totalCommissionCents: tier1CommissionCents + tier2CommissionCents,
    config,
  };
}

/** Milestone mode: below goal → tier1Rate on all MRR; at/above goal → tier2Rate on all MRR. */
export function milestoneCommissionFromMrr(
  mrrCents: number,
  config: CommissionTierConfig = commissionConfigFromEnv(),
): CommissionBreakdown {
  const safeMrr = Math.max(0, Math.round(mrrCents));
  const atOrAboveGoal = safeMrr >= config.tier1CapCents;
  const rate = atOrAboveGoal ? config.tier2Rate : config.tier1Rate;
  const totalCommissionCents = Math.round(safeMrr * rate);

  return {
    mrrCents: safeMrr,
    tier1BaseCents: atOrAboveGoal ? 0 : safeMrr,
    tier1CommissionCents: atOrAboveGoal ? 0 : totalCommissionCents,
    tier2BaseCents: atOrAboveGoal ? safeMrr : 0,
    tier2CommissionCents: atOrAboveGoal ? totalCommissionCents : 0,
    totalCommissionCents,
    config,
  };
}

export function commissionFromMrr(
  mrrCents: number,
  mode: CommissionSplitMode = commissionSplitMode(),
): CommissionBreakdown | null {
  if (mode === "tiered") return tieredCommissionFromMrr(mrrCents);
  if (mode === "milestone") return milestoneCommissionFromMrr(mrrCents);
  return null;
}

function monthlyAmountCents(price: import("stripe").Stripe.Price, quantity: number): number {
  const unit = price.unit_amount ?? 0;
  const qty = quantity || 1;
  const interval = price.recurring?.interval;
  if (interval === "year") return Math.round((unit * qty) / 12);
  if (interval === "week") return Math.round(((unit * qty) / 7) * 30);
  if (interval === "day") return Math.round(unit * qty * 30);
  return unit * qty;
}

export async function fetchActiveMrrCents(): Promise<{
  mrrCents: number;
  activeSubscriptions: number;
}> {
  const stripe = getStripe();
  if (!stripe) return { mrrCents: 0, activeSubscriptions: 0 };

  let mrrCents = 0;
  let activeSubscriptions = 0;

  for await (const sub of stripe.subscriptions.list({
    status: "active",
    limit: 100,
    expand: ["data.items.data.price"],
  })) {
    activeSubscriptions++;
    for (const item of sub.items.data) {
      const price = item.price;
      if (!price || typeof price === "string") continue;
      if (!price.recurring) continue;
      mrrCents += monthlyAmountCents(price, item.quantity ?? 1);
    }
  }

  return { mrrCents, activeSubscriptions };
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function currentCommissionPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousCommissionPeriod(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}