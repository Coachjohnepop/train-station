/**
 * Allocate visible Stripe cash across the four next-phase buckets.
 * Pure — no I/O. Wallets (where cash sits) vs buckets (where it should go).
 */

export type MoneyDeskSettingsInput = {
  grokCents: number;
  vercelCents: number;
  supabaseCents: number;
  refundBufferCents: number;
  /** 0–100 of leftover after platform fees + John Pay. Remainder is Jeremy Pay. */
  reinvestPercent: number;
};

export type MoneyDeskSplitInput = MoneyDeskSettingsInput & {
  faCents: number;
  availableCents: number;
  pendingCents: number;
  johnPayCents: number;
};

export type MoneyDeskBucket = {
  id: "platform_fees" | "reinvest" | "jeremy_pay" | "john_pay";
  label: string;
  amountCents: number;
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
  reinvestPercent: number;
  jeremyPayPercent: number;
  buckets: MoneyDeskBucket[];
};

function clampCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function platformFeesTotalCents(s: MoneyDeskSettingsInput): number {
  return clampCents(s.grokCents) + clampCents(s.vercelCents) + clampCents(s.supabaseCents);
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
  const platformFeesCents = grok + vercel + supabase;
  const refundBufferCents = clampCents(input.refundBufferCents);
  const reinvestPercent = clampPercent(input.reinvestPercent);
  const jeremyPayPercent = 100 - reinvestPercent;

  const johnWanted = clampCents(input.johnPayCents);
  const afterFees = Math.max(0, visibleCents - platformFeesCents);
  const johnPayCents = Math.min(johnWanted, afterFees);
  const leftoverCents = Math.max(0, afterFees - johnPayCents);
  const reinvestCents = Math.round((leftoverCents * reinvestPercent) / 100);
  const jeremyPayCents = leftoverCents - reinvestCents;

  const buckets: MoneyDeskBucket[] = [
    {
      id: "platform_fees",
      label: "Platform Fees",
      amountCents: platformFeesCents,
      detail: `Grok $${(grok / 100).toFixed(0)} · Vercel $${(vercel / 100).toFixed(0)} · Supabase $${(supabase / 100).toFixed(0)} / mo`,
    },
    {
      id: "john_pay",
      label: "John Pay",
      amountCents: johnPayCents,
      detail: johnWanted > johnPayCents
        ? `Partner pool $${(johnWanted / 100).toFixed(2)} — short vs visible cash`
        : "Partner share (Connect) — not at swipe",
    },
    {
      id: "reinvest",
      label: "Reinvest",
      amountCents: reinvestCents,
      detail: `${reinvestPercent}% of leftover after fees + John · hold in FA / Stripe`,
    },
    {
      id: "jeremy_pay",
      label: "Jeremy Pay",
      amountCents: jeremyPayCents,
      detail: `${jeremyPayPercent}% of leftover · business bank when you Confirm`,
    },
  ];

  return {
    visibleCents,
    paymentsCents,
    faCents,
    platformFeesCents,
    refundBufferCents,
    johnPayCents,
    leftoverCents,
    reinvestCents,
    jeremyPayCents,
    reinvestPercent,
    jeremyPayPercent,
    buckets,
  };
}
