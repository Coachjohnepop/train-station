/**
 * Allocate visible Stripe cash across the four buckets.
 * Pure — no I/O. Wallets (where cash sits) vs buckets (where it should go).
 */

export type MoneyDeskPercents = {
  platformFeesPercent: number;
  johnPayPercent: number;
  reinvestPercent: number;
  jeremyPayPercent: number;
};

export type MoneyDeskSettingsInput = MoneyDeskPercents & {
  grokCents: number;
  vercelCents: number;
  supabaseCents: number;
  refundBufferCents: number;
};

export type MoneyDeskSplitInput = MoneyDeskSettingsInput & {
  faCents: number;
  availableCents: number;
  pendingCents: number;
};

export type MoneyDeskBucket = {
  id: "platform_fees" | "reinvest" | "jeremy_pay" | "john_pay";
  label: string;
  amountCents: number;
  percent: number;
  detail: string;
};

export type MoneyDeskSplit = {
  visibleCents: number;
  paymentsCents: number;
  faCents: number;
  platformFeesCents: number;
  refundBufferCents: number;
  johnPayCents: number;
  leftoverCents: number;
  reinvestCents: number;
  jeremyPayCents: number;
  platformFeesPercent: number;
  johnPayPercent: number;
  reinvestPercent: number;
  jeremyPayPercent: number;
  buckets: MoneyDeskBucket[];
};

export const EVEN_SPLIT_PERCENTS: MoneyDeskPercents = {
  platformFeesPercent: 25,
  johnPayPercent: 25,
  reinvestPercent: 25,
  jeremyPayPercent: 25,
};

function clampCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function platformFeesTotalCents(s: Pick<MoneyDeskSettingsInput, "grokCents" | "vercelCents" | "supabaseCents">): number {
  return clampCents(s.grokCents) + clampCents(s.vercelCents) + clampCents(s.supabaseCents);
}

/** First three buckets get rounded shares; Jeremy Pay gets the remainder so cents sum. */
export function allocateByPercents(
  totalCents: number,
  percents: MoneyDeskPercents,
): {
  platformFeesCents: number;
  johnPayCents: number;
  reinvestCents: number;
  jeremyPayCents: number;
} {
  const total = clampCents(totalCents);
  const pFees = clampPercent(percents.platformFeesPercent);
  const pJohn = clampPercent(percents.johnPayPercent);
  const pReinvest = clampPercent(percents.reinvestPercent);
  const platformFeesCents = Math.round((total * pFees) / 100);
  const johnPayCents = Math.round((total * pJohn) / 100);
  const reinvestCents = Math.round((total * pReinvest) / 100);
  const jeremyPayCents = total - platformFeesCents - johnPayCents - reinvestCents;
  return { platformFeesCents, johnPayCents, reinvestCents, jeremyPayCents };
}

export function splitVisibleCash(input: MoneyDeskSplitInput): MoneyDeskSplit {
  const faCents = Math.round(input.faCents || 0);
  const availableCents = Math.round(input.availableCents || 0);
  const pendingCents = Math.round(input.pendingCents || 0);
  const paymentsCents = Math.max(0, availableCents) + Math.max(0, pendingCents);
  const visibleCents = paymentsCents + Math.max(0, faCents);

  const grok = clampCents(input.grokCents);
  const vercel = clampCents(input.vercelCents);
  const supabase = clampCents(input.supabaseCents);
  const refundBufferCents = clampCents(input.refundBufferCents);

  const percents: MoneyDeskPercents = {
    platformFeesPercent: clampPercent(input.platformFeesPercent),
    johnPayPercent: clampPercent(input.johnPayPercent),
    reinvestPercent: clampPercent(input.reinvestPercent),
    jeremyPayPercent: clampPercent(input.jeremyPayPercent),
  };

  const parts = allocateByPercents(visibleCents, percents);

  const buckets: MoneyDeskBucket[] = [
    {
      id: "platform_fees",
      label: "Platform Fees",
      amountCents: parts.platformFeesCents,
      percent: percents.platformFeesPercent,
      detail: `${percents.platformFeesPercent}% · Grok $${(grok / 100).toFixed(0)} / Vercel $${(vercel / 100).toFixed(0)} / Supabase $${(supabase / 100).toFixed(0)} listed`,
    },
    {
      id: "john_pay",
      label: "John Pay",
      amountCents: parts.johnPayCents,
      percent: percents.johnPayPercent,
      detail: `${percents.johnPayPercent}% · Connect when you Confirm`,
    },
    {
      id: "reinvest",
      label: "Reinvest",
      amountCents: parts.reinvestCents,
      percent: percents.reinvestPercent,
      detail: `${percents.reinvestPercent}% · hold in FA / Stripe`,
    },
    {
      id: "jeremy_pay",
      label: "Jeremy Pay",
      amountCents: parts.jeremyPayCents,
      percent: percents.jeremyPayPercent,
      detail: `${percents.jeremyPayPercent}% · business bank when you Confirm`,
    },
  ];

  return {
    visibleCents,
    paymentsCents,
    faCents,
    platformFeesCents: parts.platformFeesCents,
    refundBufferCents,
    johnPayCents: parts.johnPayCents,
    leftoverCents: 0,
    reinvestCents: parts.reinvestCents,
    jeremyPayCents: parts.jeremyPayCents,
    platformFeesPercent: percents.platformFeesPercent,
    johnPayPercent: percents.johnPayPercent,
    reinvestPercent: percents.reinvestPercent,
    jeremyPayPercent: percents.jeremyPayPercent,
    buckets,
  };
}
