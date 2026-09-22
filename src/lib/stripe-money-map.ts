import "server-only";

import { formatUsdFromCents } from "@/lib/stripe-commission";
import {
  commissionFromMrr,
  commissionPayoutMinCentsFromEnv,
  commissionSplitMode,
  fetchActiveMrrCents,
  previousCommissionPeriod,
  revenueSplitFromMrr,
} from "@/lib/stripe-commission";
import { listCommissionPartners } from "@/lib/commission-partners-store";
import { getConnectPartnerStatus } from "@/lib/stripe-connect";
import { getMoneyDeskSettings } from "@/lib/money-desk-settings";
import { splitVisibleCash, type MoneyDeskSplit } from "@/lib/money-desk-split";
import { getStripe } from "@/lib/stripe";
import { getStripeBalanceSnapshot } from "@/lib/stripe-account-money";
import { listCommissionPayouts } from "@/lib/commission-ledger-store";

export type FinancialAccountSnap = {
  id: string | null;
  availableCents: number | null;
  availableLabel: string | null;
  source: "live" | "payout_ledger" | "none";
  note: string;
  inboundCents: number;
  returnedCents: number;
  transferCount: number;
};

export type PayoutScheduleSnap = {
  interval: string | null;
  manual: boolean;
  autoFaRules: boolean;
  label: string;
};

export type MoneyMap = {
  payoutSchedule: PayoutScheduleSnap;
  financialAccount: FinancialAccountSnap;
  payments: {
    availableCents: number | null;
    availableLabel: string | null;
    pendingCents: number | null;
    pendingLabel: string | null;
  };
  /** Available + pending + Financial Account. Bank payouts already sent are excluded. */
  grandStripe: {
    cents: number | null;
    label: string | null;
    includesFinancialAccount: boolean;
  };
  settings: Awaited<ReturnType<typeof getMoneyDeskSettings>>;
  split: MoneyDeskSplit;
  johnPay: {
    poolCents: number;
    poolLabel: string;
    floorCents: number;
    floorLabel: string;
    floorMet: boolean;
    connectReady: boolean;
    connectAccountId: string | null;
    periodPaid: boolean;
  };
  lastFaTransfer: {
    id: string;
    amountLabel: string;
    createdAt: string;
  } | null;
  lastBankPayout: {
    id: string;
    amountLabel: string;
    createdAt: string;
  } | null;
};

type StripeLike = {
  balanceSettings: { retrieve: () => Promise<unknown> };
  payouts: { list: (opts: { limit: number }) => Promise<{ data: Array<Record<string, unknown>> }> };
  balanceTransactions: {
    list: (opts: { limit: number }) => Promise<{ data: Array<Record<string, unknown>> }>;
  };
  request?: (opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
  }) => Promise<unknown>;
};

function money(cents: number): string {
  return formatUsdFromCents(cents);
}

export function payoutGoesToFinancialAccount(p: Record<string, unknown>): boolean {
  const type = typeof p.type === "string" ? p.type : "";
  const method = typeof p.payout_method === "string" ? p.payout_method : "";
  const desc = typeof p.description === "string" ? p.description : "";
  return (
    type === "payout_method" ||
    method.startsWith("fa_") ||
    /financial account|automatic balance transfer/i.test(desc)
  );
}

async function readBalanceSettings(stripe: StripeLike): Promise<{
  interval: string | null;
  faId: string | null;
  autoFaRules: boolean;
}> {
  try {
    const raw = (await stripe.balanceSettings.retrieve()) as {
      payments?: {
        payouts?: {
          schedule?: { interval?: string };
          automatic_transfer_rules_by_currency?: Record<
            string,
            Array<{ payout_method?: string }>
          > | null;
        };
      };
    };
    const po = raw.payments?.payouts;
    const interval = po?.schedule?.interval || null;
    const rules = po?.automatic_transfer_rules_by_currency || null;
    const usd = rules?.usd || [];
    const faId = usd[0]?.payout_method || null;
    return { interval, faId, autoFaRules: usd.length > 0 };
  } catch {
    return { interval: null, faId: null, autoFaRules: false };
  }
}

async function tryLiveFaBalance(faId: string): Promise<number | null> {
  const rk =
    process.env.STRIPE_FA_RESTRICTED_KEY?.trim() ||
    process.env.STRIPE_MONEY_MANAGEMENT_KEY?.trim() ||
    "";
  if (!rk) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v2/money_management/financial_accounts/${faId}`,
      {
        headers: {
          Authorization: `Bearer ${rk}`,
          "Stripe-Version": "2026-06-24.preview",
        },
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      balance?: { available?: { usd?: { value?: number } } };
      error?: { message?: string };
    };
    if (!res.ok) return null;
    const value = body.balance?.available?.usd?.value;
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

export async function getFinancialAccountSnapshot(): Promise<FinancialAccountSnap> {
  const stripe = getStripe() as unknown as StripeLike | null;
  const empty: FinancialAccountSnap = {
    id: null,
    availableCents: null,
    availableLabel: null,
    source: "none",
    note: "No Financial Account transfers on this key yet.",
    inboundCents: 0,
    returnedCents: 0,
    transferCount: 0,
  };
  if (!stripe) return empty;

  const settings = await readBalanceSettings(stripe);
  let faId = settings.faId;
  let inbound = 0;
  let returned = 0;
  let count = 0;
  let lastCreated = 0;

  try {
    const payouts = await stripe.payouts.list({ limit: 100 });
    for (const p of payouts.data) {
      if (!payoutGoesToFinancialAccount(p)) continue;
      if (p.status !== "paid" && p.status !== "in_transit" && p.status !== "pending") continue;
      const amt = typeof p.amount === "number" ? p.amount : 0;
      inbound += amt;
      count += 1;
      const created = typeof p.created === "number" ? p.created : 0;
      if (created > lastCreated) lastCreated = created;
      const method = typeof p.payout_method === "string" ? p.payout_method : "";
      if (!faId && method.startsWith("fa_")) faId = method;
    }
  } catch {
    /* listed below */
  }

  try {
    const txs = await stripe.balanceTransactions.list({ limit: 100 });
    for (const t of txs.data) {
      if (t.type !== "topup") continue;
      const desc = typeof t.description === "string" ? t.description : "";
      if (!/financial account/i.test(desc)) continue;
      const net = typeof t.net === "number" ? t.net : 0;
      returned += Math.abs(net);
    }
  } catch {
    /* ignore */
  }

  const ledgerCents = inbound - returned;
  const live = faId ? await tryLiveFaBalance(faId) : null;

  if (live != null) {
    return {
      id: faId,
      availableCents: live,
      availableLabel: money(live),
      source: "live",
      note: "Live Financial Account balance (restricted key).",
      inboundCents: inbound,
      returnedCents: returned,
      transferCount: count,
    };
  }

  if (count === 0 && !faId) return empty;

  return {
    id: faId,
    availableCents: ledgerCents,
    availableLabel: money(ledgerCents),
    source: "payout_ledger",
    note: "Sum of payments-balance → FA transfers minus FA top-ups back. Outbound from FA to a bank (Dashboard) is not in this number until a restricted key is set (STRIPE_FA_RESTRICTED_KEY).",
    inboundCents: inbound,
    returnedCents: returned,
    transferCount: count,
  };
}

export async function getPayoutScheduleSnapshot(): Promise<PayoutScheduleSnap> {
  const stripe = getStripe() as unknown as StripeLike | null;
  if (!stripe) {
    return { interval: null, manual: false, autoFaRules: false, label: "Stripe not configured" };
  }
  const s = await readBalanceSettings(stripe);
  const interval = s.interval;
  const manual = interval === "manual";
  const label = manual
    ? s.autoFaRules
      ? "Manual payouts · FA auto-transfer still ON"
      : "Manual payouts · look then pay"
    : `Automatic ${interval || "schedule"}`;
  return { interval, manual, autoFaRules: s.autoFaRules, label };
}

export async function getMoneyMap(): Promise<MoneyMap> {
  const [settings, fa, schedule, balance, mrr, partners, payouts] = await Promise.all([
    getMoneyDeskSettings(),
    getFinancialAccountSnapshot(),
    getPayoutScheduleSnapshot(),
    getStripeBalanceSnapshot("platform"),
    fetchActiveMrrCents().catch(() => ({ mrrCents: 0, activeSubscriptions: 0 })),
    listCommissionPartners().catch(() => []),
    listCommissionPayouts().catch(() => []),
  ]);

  const mode = commissionSplitMode();
  const breakdown = commissionFromMrr(mrr.mrrCents, mode);
  const johnWanted =
    breakdown?.totalCommissionCents ??
    revenueSplitFromMrr(
      mrr.mrrCents,
      partners.filter((p) => p.enabled).reduce((s, p) => s + p.sharePercent, 0),
    ).totalPartnerPayoutCents;

  const johnPartner =
    partners.find((p) => p.enabled && /john/i.test(p.email || p.name || "")) ||
    partners.find((p) => p.enabled && p.stripeAccountId) ||
    null;
  let connectReady = false;
  if (johnPartner) {
    const st = await getConnectPartnerStatus(johnPartner.id).catch(() => null);
    connectReady = Boolean(st?.payoutsEnabled && st.detailsSubmitted);
  }

  const period = previousCommissionPeriod();
  const periodPaid = payouts.some((p) => p.period === period && p.status === "paid");

  const split = splitVisibleCash({
    faCents: fa.availableCents ?? 0,
    availableCents: balance.availableCents ?? 0,
    pendingCents: balance.pendingCents ?? 0,
    grokCents: settings.grokCents,
    vercelCents: settings.vercelCents,
    supabaseCents: settings.supabaseCents,
    refundBufferCents: settings.refundBufferCents,
    platformFeesPercent: settings.platformFeesPercent,
    johnPayPercent: settings.johnPayPercent,
    reinvestPercent: settings.reinvestPercent,
    jeremyPayPercent: settings.jeremyPayPercent,
  });

  const stripe = getStripe() as unknown as StripeLike | null;
  let lastFaTransfer: MoneyMap["lastFaTransfer"] = null;
  let lastBankPayout: MoneyMap["lastBankPayout"] = null;
  if (stripe) {
    try {
      const list = await stripe.payouts.list({ limit: 20 });
      for (const p of list.data) {
        const row = {
          id: String(p.id || ""),
          amountLabel: money(typeof p.amount === "number" ? p.amount : 0),
          createdAt: new Date(((p.created as number) || 0) * 1000).toISOString(),
        };
        if (!lastFaTransfer && payoutGoesToFinancialAccount(p)) lastFaTransfer = row;
        if (!lastBankPayout && !payoutGoesToFinancialAccount(p)) lastBankPayout = row;
        if (lastFaTransfer && lastBankPayout) break;
      }
    } catch {
      /* ignore */
    }
  }

  const floorCents = commissionPayoutMinCentsFromEnv();
  const grandParts = [balance.availableCents, balance.pendingCents, fa.availableCents].filter(
    (n): n is number => typeof n === "number",
  );
  const grandStripe = {
    cents: grandParts.length ? grandParts.reduce((sum, n) => sum + n, 0) : null,
    label: grandParts.length
      ? money(grandParts.reduce((sum, n) => sum + n, 0))
      : null,
    includesFinancialAccount: typeof fa.availableCents === "number",
  };

  return {
    payoutSchedule: schedule,
    financialAccount: fa,
    payments: {
      availableCents: balance.availableCents,
      availableLabel: balance.availableLabel,
      pendingCents: balance.pendingCents,
      pendingLabel: balance.pendingLabel,
    },
    grandStripe,
    settings,
    split,
    johnPay: {
      poolCents: johnWanted,
      poolLabel: money(johnWanted),
      floorCents,
      floorLabel: money(floorCents),
      floorMet: johnWanted >= floorCents,
      connectReady,
      connectAccountId: johnPartner?.stripeAccountId || null,
      periodPaid,
    },
    lastFaTransfer,
    lastBankPayout,
  };
}
