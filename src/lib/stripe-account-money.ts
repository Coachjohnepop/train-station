/**
 * Multi-account Stripe money: platform (Jeremy) + Connect partners (John, …).
 *
 * Still one STRIPE_SECRET_KEY (platform). Connected accounts are scoped with
 * `{ stripeAccount: acct_… }` — no separate secret keys.
 *
 * Two cash steps:
 *  1) Share transfer  — platform → partner Connect balance
 *  2) Bank payout     — that account’s Stripe → their bank (owner decides)
 */

import "server-only";

import type Stripe from "stripe";
import { listCommissionPartners } from "@/lib/commission-partners-store";
import { getStripe, getStripePublishableKey } from "@/lib/stripe";
import { formatUsdFromCents } from "@/lib/stripe-commission";
import { isStripeTestMode } from "@/lib/stripe-price-ids";

export type MoneyAccountKind = "platform" | "connect";

export type MoneyAccount = {
  /** "platform" or Stripe acct_… or pending:{partnerId} */
  id: string;
  kind: MoneyAccountKind;
  label: string;
  subtitle: string;
  partnerId: string | null;
  stripeAccountId: string | null;
  email: string | null;
  enabled: boolean;
  /** True when platform key is not Jeremy / Train Station business */
  merchantMismatch?: boolean;
  merchantMismatchReason?: string | null;
};

export type StripeBalanceSnapshot = {
  configured: boolean;
  testMode: boolean;
  publishableKeyPresent: boolean;
  accountId: string;
  accountKind: MoneyAccountKind;
  accountLabel: string;
  /** Real Stripe acct_… for platform key (or Connect destination) */
  stripeMerchantAccountId: string | null;
  stripeMerchantEmail: string | null;
  stripeMerchantBusinessName: string | null;
  merchantMismatch: boolean;
  merchantMismatchReason: string | null;
  availableCents: number | null;
  availableLabel: string | null;
  pendingCents: number | null;
  pendingLabel: string | null;
  currencies: Array<{
    currency: string;
    availableCents: number;
    pendingCents: number;
    availableLabel: string;
    pendingLabel: string;
  }>;
  error: string | null;
};

/** Emails / name fragments that indicate Jeremy’s Train Station master (not John personal). */
const JEREMY_MASTER_EMAIL_HINTS = [
  "coachbyrd",
  "jeremybyrd",
  "jeremy@thetrainstation",
  "byrd@thetrainstation",
];
const JOHN_PERSONAL_EMAIL_HINTS = [
  "john@bcxvoice",
  "john@lemonvoice",
  "johnepop",
  "john.popham",
  "johnpopham",
];

export type PlatformMerchantIdentity = {
  accountId: string | null;
  email: string | null;
  businessName: string | null;
  displayName: string | null;
  looksLikeJeremyMaster: boolean;
  looksLikeJohnPersonal: boolean;
  mismatch: boolean;
  mismatchReason: string | null;
};

export async function getPlatformMerchantIdentity(): Promise<PlatformMerchantIdentity> {
  const empty: PlatformMerchantIdentity = {
    accountId: null,
    email: null,
    businessName: null,
    displayName: null,
    looksLikeJeremyMaster: false,
    looksLikeJohnPersonal: false,
    mismatch: false,
    mismatchReason: null,
  };
  const stripe = getStripe();
  if (!stripe) return empty;
  try {
    // Platform identity = GET /v1/account (typed retrieve requires a connected acct id).
    const acct = (await (stripe as unknown as {
      accounts: {
        retrieve: (id?: string) => Promise<{
          id?: string;
          email?: string | null;
          business_profile?: { name?: string | null } | null;
          company?: { name?: string | null } | null;
          settings?: { dashboard?: { display_name?: string | null } | null } | null;
        }>;
      };
    }).accounts.retrieve(undefined as unknown as string)) as {
      id?: string;
      email?: string | null;
      business_profile?: { name?: string | null } | null;
      company?: { name?: string | null } | null;
      settings?: { dashboard?: { display_name?: string | null } | null } | null;
    };
    const email = (acct.email || "").trim().toLowerCase() || null;
    const businessName =
      (acct.business_profile?.name || acct.company?.name || "").trim() || null;
    const displayName =
      (acct.settings?.dashboard?.display_name || "").trim() || null;
    const blob = `${email || ""} ${businessName || ""} ${displayName || ""}`.toLowerCase();
    const looksLikeJeremyMaster =
      JEREMY_MASTER_EMAIL_HINTS.some((h) => blob.includes(h)) ||
      /\btrain\s*station\b/i.test(businessName || "") ||
      /\btrain\s*station\b/i.test(displayName || "");
    const looksLikeJohnPersonal =
      JOHN_PERSONAL_EMAIL_HINTS.some((h) => blob.includes(h)) ||
      /\bpopham\b/i.test(blob);
    let mismatch = false;
    let mismatchReason: string | null = null;
    if (looksLikeJohnPersonal && !looksLikeJeremyMaster) {
      mismatch = true;
      mismatchReason =
        "STRIPE_SECRET_KEY is a John/personal Stripe account. Member balances and charges will settle there. Replace Production keys with Jeremy’s Train Station Live sk_live / pk_live.";
    } else if (!looksLikeJeremyMaster && email) {
      mismatch = true;
      mismatchReason = `Platform key is logged in as ${email} (${acct.id}). Expected Jeremy’s Train Station business account. Confirm Dashboard ownership before taking real member payments.`;
    }
    return {
      accountId: acct.id || null,
      email,
      businessName,
      displayName,
      looksLikeJeremyMaster,
      looksLikeJohnPersonal,
      mismatch,
      mismatchReason,
    };
  } catch {
    return empty;
  }
}

export type BalanceActivityRow = {
  id: string;
  type: string;
  status: string;
  reportingCategory: string | null;
  amountCents: number;
  amountLabel: string;
  feeCents: number;
  feeLabel: string;
  netCents: number;
  netLabel: string;
  currency: string;
  description: string | null;
  createdAt: string;
  sourceId: string | null;
};

export type BankPayoutRow = {
  id: string;
  amountCents: number;
  amountLabel: string;
  currency: string;
  status: string;
  automatic: boolean;
  method: string | null;
  arrivalDate: string | null;
  createdAt: string;
  destinationLabel: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  description: string | null;
};

export type ShareTransferRow = {
  id: string;
  amountCents: number;
  amountLabel: string;
  currency: string;
  createdAt: string;
  description: string | null;
  destinationAccountId: string | null;
  reversed: boolean;
  metadata: Record<string, string>;
};

function money(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function requestOpts(stripeAccountId: string | null | undefined): Stripe.RequestOptions | undefined {
  if (!stripeAccountId || stripeAccountId === "platform") return undefined;
  return { stripeAccount: stripeAccountId };
}

function sumUsd(
  buckets: Stripe.Balance.Available[] | Stripe.Balance.Pending[] | undefined,
): number | null {
  if (!buckets) return null;
  return buckets.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0);
}

function currencyRows(balance: Stripe.Balance | null): StripeBalanceSnapshot["currencies"] {
  if (!balance) return [];
  const map = new Map<string, { availableCents: number; pendingCents: number }>();
  for (const b of balance.available || []) {
    const cur = (b.currency || "usd").toLowerCase();
    const prev = map.get(cur) || { availableCents: 0, pendingCents: 0 };
    prev.availableCents += b.amount;
    map.set(cur, prev);
  }
  for (const b of balance.pending || []) {
    const cur = (b.currency || "usd").toLowerCase();
    const prev = map.get(cur) || { availableCents: 0, pendingCents: 0 };
    prev.pendingCents += b.amount;
    map.set(cur, prev);
  }
  return Array.from(map.entries()).map(([currency, v]) => ({
    currency,
    availableCents: v.availableCents,
    pendingCents: v.pendingCents,
    availableLabel: money(v.availableCents, currency),
    pendingLabel: money(v.pendingCents, currency),
  }));
}

/** Platform + every commission partner (linked Connect first, then pending). */
export async function listMoneyAccounts(): Promise<{
  accounts: MoneyAccount[];
  configured: boolean;
  testMode: boolean;
  platformMerchant: PlatformMerchantIdentity;
}> {
  const stripe = getStripe();
  const platformMerchant = await getPlatformMerchantIdentity();

  const who =
    platformMerchant.businessName ||
    platformMerchant.displayName ||
    platformMerchant.email ||
    platformMerchant.accountId ||
    "unknown";
  const platformLabel = platformMerchant.looksLikeJeremyMaster
    ? "Train Station (Jeremy)"
    : platformMerchant.mismatch
      ? `Wrong master · ${who}`
      : `Platform · ${who}`;
  const platformSubtitle = platformMerchant.mismatch
    ? "⚠️ STRIPE_SECRET_KEY is not Jeremy’s business account"
    : platformMerchant.email
      ? `Master · ${platformMerchant.email}${platformMerchant.accountId ? ` · ${platformMerchant.accountId}` : ""}`
      : "Platform · member charges land here";

  const platform: MoneyAccount = {
    id: "platform",
    kind: "platform",
    label: platformLabel,
    subtitle: platformSubtitle,
    partnerId: null,
    stripeAccountId: platformMerchant.accountId,
    email: platformMerchant.email,
    enabled: true,
    merchantMismatch: platformMerchant.mismatch,
    merchantMismatchReason: platformMerchant.mismatchReason,
  };

  const partners = await listCommissionPartners().catch(() => []);
  const connectAccounts: MoneyAccount[] = partners
    .filter((p) => p.stripeAccountId)
    .map((p) => ({
      id: p.stripeAccountId!,
      kind: "connect" as const,
      label: p.name || "Partner",
      subtitle: `Connect · partner share${p.enabled === false ? " (disabled)" : ""}`,
      partnerId: p.id,
      stripeAccountId: p.stripeAccountId,
      email: p.email || null,
      enabled: p.enabled !== false,
    }));

  const pendingPartners: MoneyAccount[] = partners
    .filter((p) => !p.stripeAccountId)
    .map((p) => ({
      id: `pending:${p.id}`,
      kind: "connect" as const,
      label: p.name || "Partner",
      subtitle: "Connect not linked yet",
      partnerId: p.id,
      stripeAccountId: null,
      email: p.email || null,
      enabled: p.enabled !== false,
    }));

  return {
    accounts: [platform, ...connectAccounts, ...pendingPartners],
    configured: Boolean(stripe),
    testMode: isStripeTestMode(),
    platformMerchant,
  };
}

export function resolveAccountContext(accountParam: string | null | undefined): {
  accountId: string;
  stripeAccountId: string | null;
  kind: MoneyAccountKind;
} {
  const raw = (accountParam || "platform").trim();
  if (!raw || raw === "platform") {
    return { accountId: "platform", stripeAccountId: null, kind: "platform" };
  }
  if (raw.startsWith("pending:")) {
    return { accountId: raw, stripeAccountId: null, kind: "connect" };
  }
  if (raw.startsWith("acct_")) {
    return { accountId: raw, stripeAccountId: raw, kind: "connect" };
  }
  return { accountId: raw, stripeAccountId: null, kind: "connect" };
}

export async function getStripeBalanceSnapshot(
  accountParam: string | null | undefined = "platform",
  accountLabel?: string,
): Promise<StripeBalanceSnapshot> {
  const ctx = resolveAccountContext(accountParam);
  const stripe = getStripe();
  const platformMerchant =
    ctx.kind === "platform" ? await getPlatformMerchantIdentity() : null;

  const identityLabel =
    ctx.kind === "platform"
      ? platformMerchant?.looksLikeJeremyMaster
        ? "Train Station (Jeremy)"
        : platformMerchant?.businessName ||
          platformMerchant?.email ||
          platformMerchant?.accountId ||
          "Platform (STRIPE_SECRET_KEY)"
      : ctx.accountId;

  const base = {
    configured: Boolean(stripe),
    testMode: isStripeTestMode(),
    publishableKeyPresent: Boolean(getStripePublishableKey()),
    accountId: ctx.accountId,
    accountKind: ctx.kind,
    accountLabel: accountLabel || identityLabel,
    stripeMerchantAccountId:
      ctx.kind === "platform"
        ? platformMerchant?.accountId || null
        : ctx.stripeAccountId,
    stripeMerchantEmail:
      ctx.kind === "platform" ? platformMerchant?.email || null : null,
    stripeMerchantBusinessName:
      ctx.kind === "platform" ? platformMerchant?.businessName || null : null,
    merchantMismatch: ctx.kind === "platform" ? Boolean(platformMerchant?.mismatch) : false,
    merchantMismatchReason:
      ctx.kind === "platform" ? platformMerchant?.mismatchReason || null : null,
  };

  if (!stripe) {
    return {
      ...base,
      availableCents: null,
      availableLabel: null,
      pendingCents: null,
      pendingLabel: null,
      currencies: [],
      error: "Stripe is not configured (missing STRIPE_SECRET_KEY).",
    };
  }

  if (ctx.kind === "connect" && !ctx.stripeAccountId) {
    return {
      ...base,
      availableCents: null,
      availableLabel: null,
      pendingCents: null,
      pendingLabel: null,
      currencies: [],
      error: "This partner has not finished Stripe Connect onboarding.",
    };
  }

  try {
    const balance = await stripe.balance.retrieve(
      undefined,
      requestOpts(ctx.stripeAccountId),
    );
    const available = sumUsd(balance.available);
    const pending = sumUsd(balance.pending);
    return {
      ...base,
      availableCents: available,
      availableLabel: available == null ? null : formatUsdFromCents(available),
      pendingCents: pending,
      pendingLabel: pending == null ? null : formatUsdFromCents(pending),
      currencies: currencyRows(balance),
      error: null,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load Stripe balance.";
    return {
      ...base,
      availableCents: null,
      availableLabel: null,
      pendingCents: null,
      pendingLabel: null,
      currencies: [],
      error: message,
    };
  }
}

export async function listBalanceActivity(
  accountParam: string | null | undefined = "platform",
  opts?: { limit?: number; startingAfter?: string },
): Promise<{ rows: BalanceActivityRow[]; hasMore: boolean; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { rows: [], hasMore: false, error: "Stripe is not configured." };

  const ctx = resolveAccountContext(accountParam);
  if (ctx.kind === "connect" && !ctx.stripeAccountId) {
    return { rows: [], hasMore: false, error: "Partner Connect account not linked yet." };
  }

  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
  try {
    const list = await stripe.balanceTransactions.list(
      {
        limit,
        ...(opts?.startingAfter ? { starting_after: opts.startingAfter } : {}),
      },
      requestOpts(ctx.stripeAccountId),
    );

    const rows: BalanceActivityRow[] = list.data.map((tx) => {
      const source =
        typeof tx.source === "string"
          ? tx.source
          : tx.source && typeof tx.source === "object" && "id" in tx.source
            ? String((tx.source as { id: string }).id)
            : null;
      return {
        id: tx.id,
        type: tx.type,
        status: tx.status,
        reportingCategory: tx.reporting_category || null,
        amountCents: tx.amount,
        amountLabel: money(tx.amount, tx.currency),
        feeCents: tx.fee,
        feeLabel: money(tx.fee, tx.currency),
        netCents: tx.net,
        netLabel: money(tx.net, tx.currency),
        currency: tx.currency,
        description: tx.description || null,
        createdAt: new Date(tx.created * 1000).toISOString(),
        sourceId: source,
      };
    });

    return { rows, hasMore: list.has_more };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load balance activity.";
    return { rows: [], hasMore: false, error: message };
  }
}

export async function listBankPayouts(
  accountParam: string | null | undefined = "platform",
  opts?: { limit?: number; startingAfter?: string },
): Promise<{ rows: BankPayoutRow[]; hasMore: boolean; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { rows: [], hasMore: false, error: "Stripe is not configured." };

  const ctx = resolveAccountContext(accountParam);
  if (ctx.kind === "connect" && !ctx.stripeAccountId) {
    return { rows: [], hasMore: false, error: "Partner Connect account not linked yet." };
  }

  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
  try {
    const list = await stripe.payouts.list(
      {
        limit,
        ...(opts?.startingAfter ? { starting_after: opts.startingAfter } : {}),
      },
      requestOpts(ctx.stripeAccountId),
    );

    const rows: BankPayoutRow[] = list.data.map((p) => {
      let destinationLabel: string | null = null;
      const dest = p.destination;
      if (typeof dest === "string") {
        destinationLabel = dest;
      } else if (dest && typeof dest === "object") {
        const d = dest as { last4?: string; bank_name?: string; id?: string };
        if (d.bank_name || d.last4) {
          destinationLabel = [d.bank_name, d.last4 ? `••••${d.last4}` : null]
            .filter(Boolean)
            .join(" ");
        } else if (d.id) {
          destinationLabel = d.id;
        }
      }

      return {
        id: p.id,
        amountCents: p.amount,
        amountLabel: money(p.amount, p.currency),
        currency: p.currency,
        status: p.status,
        automatic: Boolean(p.automatic),
        method: p.method || null,
        arrivalDate: p.arrival_date
          ? new Date(p.arrival_date * 1000).toISOString()
          : null,
        createdAt: new Date(p.created * 1000).toISOString(),
        destinationLabel,
        failureCode: p.failure_code || null,
        failureMessage: p.failure_message || null,
        description: p.description || null,
      };
    });

    return { rows, hasMore: list.has_more };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load bank payouts.";
    return { rows: [], hasMore: false, error: message };
  }
}

/**
 * Platform → Connect share transfers (always listed on the platform Stripe object).
 * - account=platform: recent outbound transfers
 * - account=acct_xxx: transfers to that Connect destination
 */
export async function listShareTransfers(
  accountParam: string | null | undefined = "platform",
  opts?: { limit?: number },
): Promise<{ rows: ShareTransferRow[]; hasMore: boolean; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { rows: [], hasMore: false, error: "Stripe is not configured." };

  const ctx = resolveAccountContext(accountParam);
  if (ctx.kind === "connect" && !ctx.stripeAccountId) {
    return { rows: [], hasMore: false, error: "Partner Connect account not linked yet." };
  }

  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));

  try {
    const list = await stripe.transfers.list({
      limit,
      ...(ctx.stripeAccountId ? { destination: ctx.stripeAccountId } : {}),
    });

    const rows: ShareTransferRow[] = list.data.map((t) => {
      const dest =
        typeof t.destination === "string"
          ? t.destination
          : t.destination && typeof t.destination === "object" && "id" in t.destination
            ? String((t.destination as { id: string }).id)
            : null;
      const meta: Record<string, string> = {};
      if (t.metadata) {
        for (const [k, v] of Object.entries(t.metadata)) {
          if (typeof v === "string") meta[k] = v;
        }
      }
      return {
        id: t.id,
        amountCents: t.amount,
        amountLabel: money(t.amount, t.currency),
        currency: t.currency,
        createdAt: new Date(t.created * 1000).toISOString(),
        description: t.description || null,
        destinationAccountId: dest,
        reversed: Boolean(t.reversed),
        metadata: meta,
      };
    });

    return { rows, hasMore: list.has_more };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load share transfers.";
    return { rows: [], hasMore: false, error: message };
  }
}

export async function getLastBankPayout(
  accountParam: string | null | undefined = "platform",
): Promise<BankPayoutRow | null> {
  const { rows } = await listBankPayouts(accountParam, { limit: 1 });
  return rows[0] || null;
}
