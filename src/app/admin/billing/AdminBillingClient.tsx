"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDiscountsPanel from "@/components/AdminDiscountsPanel";
import LatestStripePurchaseCard from "@/components/LatestStripePurchaseCard";

type Tab =
  | "overview"
  | "balance"
  | "charges"
  | "share"
  | "bank"
  | "activity"
  | "refunds"
  | "discounts"
  | "subscriptions";

const VALID_TABS: Tab[] = [
  "overview",
  "balance",
  "charges",
  "share",
  "bank",
  "activity",
  "refunds",
  "discounts",
  "subscriptions",
];

function tabFromParam(raw: string | null): Tab {
  if (!raw) return "overview";
  if (raw === "transactions") return "charges";
  if (raw === "bank-payouts" || raw === "payouts") return "bank";
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as Tab;
  return "overview";
}

type MoneyAccount = {
  id: string;
  kind: "platform" | "connect";
  label: string;
  subtitle: string;
  partnerId: string | null;
  stripeAccountId: string | null;
  email: string | null;
  enabled: boolean;
  merchantMismatch?: boolean;
  merchantMismatchReason?: string | null;
};

type Overview = {
  configured: boolean;
  testMode: boolean;
  publishableKeyPresent: boolean;
  message: string | null;
  balance?: {
    availableLabel: string | null;
    pendingLabel: string | null;
    error?: string | null;
  };
  lastBankPayout?: {
    id: string;
    amountLabel: string;
    status: string;
    arrivalDate: string | null;
    createdAt: string;
  } | null;
  mrr?: { label: string; activeSubscriptions: number };
  volume?: {
    gross30Label: string;
    refunded30Label: string;
    net30Label: string;
    gross7Label: string;
  };
  counts?: {
    succeededCharges: number;
    failedCharges: number;
    openPaymentIntents: number;
  };
  latestPurchase?: {
    chargeId: string;
    paymentIntentId: string | null;
    amountLabel: string;
    status: string;
    description: string | null;
    customerEmail: string | null;
    customerName: string | null;
    memberUserId: string | null;
    memberPlan: string | null;
    createdAt: string;
    cardBrand: string | null;
    cardLast4: string | null;
    receiptUrl: string | null;
  } | null;
};

type Tx = {
  id: string;
  amountLabel: string;
  refundedLabel: string;
  netLabel: string;
  amountCents: number;
  amountRefundedCents: number;
  refundableCents: number;
  status: string;
  paid: boolean;
  refunded: boolean;
  partiallyRefunded: boolean;
  description: string | null;
  customerEmail: string | null;
  customerName: string | null;
  memberUserId: string | null;
  memberPlan: string | null;
  createdAt: string;
  cardBrand: string | null;
  cardLast4: string | null;
  failureMessage: string | null;
};

type RefundRow = {
  id: string;
  chargeId: string | null;
  amountLabel: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

type Sub = {
  id: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  planLabel: string;
  amountLabel: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type BalanceSnap = {
  availableLabel: string | null;
  pendingLabel: string | null;
  accountLabel: string;
  accountKind: string;
  stripeMerchantAccountId?: string | null;
  stripeMerchantEmail?: string | null;
  stripeMerchantBusinessName?: string | null;
  merchantMismatch?: boolean;
  merchantMismatchReason?: string | null;
  currencies: Array<{
    currency: string;
    availableLabel: string;
    pendingLabel: string;
  }>;
  error: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  status: string;
  amountLabel: string;
  feeLabel: string;
  netLabel: string;
  description: string | null;
  createdAt: string;
  sourceId: string | null;
};

type BankRow = {
  id: string;
  amountLabel: string;
  status: string;
  automatic: boolean;
  arrivalDate: string | null;
  createdAt: string;
  destinationLabel: string | null;
  failureMessage: string | null;
};

type ShareRow = {
  id: string;
  amountLabel: string;
  createdAt: string;
  description: string | null;
  destinationAccountId: string | null;
  reversed: boolean;
};

type CommissionPartner = {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  sharePercent: number;
  enabled: boolean;
  connect: {
    configured: boolean;
    accountId: string | null;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null;
};

type CommissionData = {
  periodSuggested: string;
  mrr: { label: string; cents: number; activeSubscriptions: number };
  commission: { totalLabel: string };
  partners: CommissionPartner[];
  projectedSplits: Array<{
    partnerId: string;
    partnerName: string;
    sharePercent: number;
    amountLabel: string;
  }>;
  payoutMinimum?: {
    met: boolean;
    label: string;
    shortfallLabel: string;
    poolLabel: string;
  };
  paymentQueue?: Array<{
    id: string;
    payee: string;
    kindLabel: string;
    amountLabel: string;
    statusLabel: string;
    processable: boolean;
    blockedReason: string | null;
  }>;
  stripeBalance?: {
    availableLabel: string | null;
    pendingLabel: string | null;
  };
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusPill(status: string, tone?: "ok" | "warn" | "bad" | "muted") {
  const colors =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-200"
        : tone === "bad"
          ? "bg-rose-500/15 text-rose-300"
          : "bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}
    >
      {status}
    </span>
  );
}

function Kpi({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function AdminBillingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [accountId, setAccountId] = useState(() => searchParams.get("account") || "platform");
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [balance, setBalance] = useState<BalanceSnap | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [shareRows, setShareRows] = useState<ShareRow[]>([]);
  const [commission, setCommission] = useState<CommissionData | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [query, setQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  const [refundTarget, setRefundTarget] = useState<Tx | null>(null);
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  const [refundDollars, setRefundDollars] = useState("");
  const [refundReason, setRefundReason] = useState<
    "requested_by_customer" | "duplicate" | "fraudulent"
  >("requested_by_customer");
  const [refundNote, setRefundNote] = useState("");
  const [refundMsg, setRefundMsg] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || null,
    [accounts, accountId],
  );
  const isPlatform = accountId === "platform";

  const pushUrl = useCallback(
    (nextTab: Tab, nextAccount: string) => {
      const params = new URLSearchParams();
      if (nextTab !== "overview") params.set("tab", nextTab);
      if (nextAccount && nextAccount !== "platform") params.set("account", nextAccount);
      const qs = params.toString();
      router.replace(qs ? `/admin/billing?${qs}` : "/admin/billing", { scroll: false });
    },
    [router],
  );

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      pushUrl(next, accountId);
    },
    [accountId, pushUrl],
  );

  const setAccount = useCallback(
    (next: string) => {
      setAccountId(next);
      // Partner accounts: jump off platform-only tabs
      const acc = accounts.find((a) => a.id === next);
      let nextTab = tab;
      if (acc && acc.kind === "connect") {
        if (["charges", "refunds", "discounts", "subscriptions"].includes(tab)) {
          nextTab = "overview";
          setTabState(nextTab);
        }
      }
      pushUrl(nextTab, next);
    },
    [accounts, tab, pushUrl],
  );

  useEffect(() => {
    setTabState(tabFromParam(searchParams.get("tab")));
    const acc = searchParams.get("account");
    if (acc) setAccountId(acc);
  }, [searchParams]);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/admin/billing/accounts", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Accounts failed");
    setAccounts(body.accounts || []);
  }, []);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/billing/overview", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Overview failed");
    setOverview(body);
  }, []);

  const loadBalance = useCallback(async (acct: string) => {
    const res = await fetch(
      `/api/admin/billing/balance?account=${encodeURIComponent(acct)}`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Balance failed");
    setBalance(body);
  }, []);

  const loadActivity = useCallback(async (acct: string) => {
    const res = await fetch(
      `/api/admin/billing/balance-transactions?account=${encodeURIComponent(acct)}&limit=50`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Activity failed");
    setActivity(body.rows || []);
  }, []);

  const loadBank = useCallback(async (acct: string) => {
    const res = await fetch(
      `/api/admin/billing/bank-payouts?account=${encodeURIComponent(acct)}&limit=40`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Bank payouts failed");
    setBankRows(body.rows || []);
  }, []);

  const loadShare = useCallback(async (acct: string) => {
    const res = await fetch(
      `/api/admin/billing/share-transfers?account=${encodeURIComponent(acct)}&limit=40`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Share transfers failed");
    setShareRows(body.rows || []);
  }, []);

  const loadCommission = useCallback(async () => {
    const res = await fetch("/api/admin/commission", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Commission failed");
    setCommission(body);
  }, []);

  const loadTxs = useCallback(async () => {
    const res = await fetch("/api/admin/billing/transactions?limit=60", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Charges failed");
    setTxs(body.transactions || []);
  }, []);

  const loadRefunds = useCallback(async () => {
    const res = await fetch("/api/admin/billing/refunds?limit=60", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Refunds failed");
    setRefunds(body.refunds || []);
  }, []);

  const loadSubs = useCallback(async () => {
    const res = await fetch("/api/admin/billing/subscriptions?limit=50", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Subscriptions failed");
    setSubs(body.subscriptions || []);
  }, []);

  const refresh = useCallback(async () => {
    if (tab === "discounts") {
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loadAccounts();
      if (tab === "overview") {
        if (accountId === "platform") {
          await Promise.all([loadOverview(), loadBalance("platform")]);
        } else {
          await Promise.all([
            loadBalance(accountId),
            loadShare(accountId),
            loadBank(accountId),
          ]);
        }
      } else if (tab === "balance") {
        await loadBalance(accountId);
      } else if (tab === "activity") {
        await loadActivity(accountId);
      } else if (tab === "bank") {
        await loadBank(accountId);
      } else if (tab === "share") {
        await Promise.all([loadShare(accountId), loadCommission()]);
      } else if (tab === "charges") {
        await loadTxs();
      } else if (tab === "refunds") {
        await loadRefunds();
      } else if (tab === "subscriptions") {
        await loadSubs();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    accountId,
    loadAccounts,
    loadOverview,
    loadBalance,
    loadActivity,
    loadBank,
    loadShare,
    loadCommission,
    loadTxs,
    loadRefunds,
    loadSubs,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTxs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return txs;
    return txs.filter((t) =>
      [t.id, t.customerEmail, t.customerName, t.memberPlan, t.description, t.cardLast4]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [txs, query]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activity;
    return activity.filter((r) => r.type === activityFilter || r.type.includes(activityFilter));
  }, [activity, activityFilter]);

  async function submitRefund() {
    if (!refundTarget) return;
    setBusy("refund");
    setRefundMsg("");
    let amountCents: number | null = null;
    if (refundMode === "partial") {
      const dollars = Number(refundDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setRefundMsg("Enter a partial amount in dollars.");
        setBusy(null);
        return;
      }
      amountCents = Math.round(dollars * 100);
    }
    const res = await fetch("/api/admin/billing/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chargeId: refundTarget.id,
        amountCents,
        reason: refundReason,
        note: refundNote.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setRefundMsg(body.error || "Refund failed");
      return;
    }
    setRefundMsg(`Refund ${body.refund?.amountLabel || ""} created (${body.refund?.id}).`);
    setRefundTarget(null);
    await Promise.all([loadTxs(), loadRefunds(), loadOverview()]);
  }

  async function runPartnerShare(dryRun: boolean) {
    setBusy(dryRun ? "share-dry" : "share-run");
    setShareMsg("");
    setError("");
    const res = await fetch("/api/stripe/commission/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: commission?.periodSuggested, dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Share transfer failed.");
      return;
    }
    setShareMsg(
      dryRun
        ? `Preview: ${body.message || body.record?.period || "OK"}`
        : `Share processed: ${body.message || body.record?.period || "done"}`,
    );
    await Promise.all([loadShare(accountId), loadCommission(), loadBalance(accountId)]);
  }

  async function runAdminFee(dryRun: boolean) {
    setBusy(dryRun ? "admin-dry" : "admin-run");
    setShareMsg("");
    setError("");
    const res = await fetch("/api/stripe/commission/platform-admin-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error || "Platform admin fee failed.");
      return;
    }
    if (body.dryRun && body.preview) {
      setShareMsg(
        `Preview admin fee: ${body.preview.amountLabel} → ${body.preview.partnerName}. Connect ${body.preview.connectReady ? "ready" : "not ready"}.`,
      );
    } else {
      setShareMsg(
        `Admin fee paid: ${body.preview?.amountLabel ?? ""} · ${body.transferId || "ok"}`,
      );
    }
    await Promise.all([loadShare(accountId), loadCommission()]);
  }

  async function startConnect(partnerId: string) {
    setBusy(`connect-${partnerId}`);
    setError("");
    const res = await fetch("/api/stripe/connect/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error || "Connect onboarding failed.");
    setBusy(null);
  }

  async function openExpressDashboard(partnerId: string) {
    setBusy(`dash-${partnerId}`);
    setError("");
    const res = await fetch("/api/stripe/connect/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && body.url) {
      window.open(body.url, "_blank", "noopener,noreferrer");
    } else {
      setError(body.error || "Could not open Express dashboard.");
    }
  }

  const platformTabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "balance", label: "Balance" },
    { id: "charges", label: "Charges" },
    { id: "share", label: "Share" },
    { id: "bank", label: "Bank payouts" },
    { id: "activity", label: "Activity" },
    { id: "refunds", label: "Refunds" },
    { id: "discounts", label: "Discounts" },
    { id: "subscriptions", label: "Subs" },
  ];

  const connectTabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "balance", label: "Balance" },
    { id: "share", label: "Share in" },
    { id: "bank", label: "Bank payouts" },
    { id: "activity", label: "Activity" },
  ];

  const tabs = isPlatform ? platformTabs : connectTabs;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stripe money</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Two accounts, two steps: <strong className="text-[var(--text)]">Share</strong> moves
            partner revenue into their Stripe · <strong className="text-[var(--text)]">Bank</strong>{" "}
            is when each person pays out from their own Stripe to their bank.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/accounting" className="btn-ghost text-xs">
            Accounting
          </Link>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={loading || Boolean(busy)}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs"
          >
            Stripe Dashboard ↗
          </a>
        </div>
      </div>

      {/* Two-step explainer */}
      <div className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Step 1 · Share</p>
          <p className="mt-1 text-[var(--muted)]">
            Platform (Jeremy) sends partner pool into John’s Connect Stripe balance. Staff runs this
            here on the Share tab.
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Step 2 · Bank</p>
          <p className="mt-1 text-[var(--muted)]">
            Each person decides when to push <em>their</em> Stripe balance to <em>their</em> bank.
            App lists history only — no force bank button.
          </p>
        </div>
      </div>

      {/* Account switcher */}
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => {
          const active = a.id === accountId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccount(a.id)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                active
                  ? "border-accent bg-accent/15 text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <span className="block text-sm font-semibold">{a.label}</span>
              <span className="block text-[10px] opacity-80">{a.subtitle}</span>
            </button>
          );
        })}
        {accounts.length === 0 && !loading && (
          <p className="text-sm text-[var(--muted)]">No accounts loaded.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {overview &&
          statusPill(overview.testMode ? "Test mode" : "Live mode", overview.testMode ? "warn" : "ok")}
        {selectedAccount &&
          statusPill(
            selectedAccount.kind === "platform" ? "Platform account" : "Connect account",
            selectedAccount.kind === "platform" && !selectedAccount.merchantMismatch ? "ok" : "muted",
          )}
        {selectedAccount?.kind === "connect" &&
          !selectedAccount.stripeAccountId &&
          statusPill("Connect not linked", "warn")}
        {(selectedAccount?.merchantMismatch || balance?.merchantMismatch) &&
          statusPill("Wrong master account", "warn")}
      </div>

      {(selectedAccount?.merchantMismatch || balance?.merchantMismatch) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
          <p className="font-semibold text-rose-100">
            Master Stripe is not Jeremy&apos;s Train Station account
          </p>
          <p className="mt-1 text-rose-100/90">
            {selectedAccount?.merchantMismatchReason ||
              balance?.merchantMismatchReason ||
              "STRIPE_SECRET_KEY on Vercel Production is pointing at the wrong Stripe account. Balances and member card charges settle on that account."}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/85">
            <li>
              Live key identity:{" "}
              <span className="font-mono text-xs">
                {balance?.stripeMerchantEmail || selectedAccount?.email || "—"}
              </span>
              {balance?.stripeMerchantAccountId || selectedAccount?.stripeAccountId
                ? ` · ${balance?.stripeMerchantAccountId || selectedAccount?.stripeAccountId}`
                : ""}
            </li>
            <li>
              Fix: Vercel → Production → set <code className="text-xs">STRIPE_SECRET_KEY</code> +{" "}
              <code className="text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> from{" "}
              <strong>Jeremy&apos;s</strong> Live Dashboard, then redeploy.
            </li>
            <li>
              John&apos;s Stripe stays for <strong>Connect commission</strong> only — not master merchant.
            </li>
          </ul>
        </div>
      )}

      {isPlatform && balance && !balance.merchantMismatch && balance.stripeMerchantEmail && (
        <p className="text-xs text-[var(--muted)]">
          Master merchant:{" "}
          <span className="text-[var(--text)]">
            {balance.stripeMerchantBusinessName || balance.accountLabel}
          </span>
          {" · "}
          <span className="font-mono">{balance.stripeMerchantEmail}</span>
          {balance.stripeMerchantAccountId ? (
            <>
              {" · "}
              <span className="font-mono">{balance.stripeMerchantAccountId}</span>
            </>
          ) : null}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--surface-2)] text-[var(--text)]"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}
      {shareMsg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-[var(--success)]">
          {shareMsg}
        </p>
      )}

      {loading && tab !== "discounts" ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : null}

      {/* OVERVIEW */}
      {tab === "overview" && !loading && isPlatform && overview && (
        <div className="space-y-4">
          {!overview.configured && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {overview.message || "Configure STRIPE_SECRET_KEY on Vercel."}
            </p>
          )}
          <LatestStripePurchaseCard purchase={overview.latestPurchase} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              title="Available"
              value={balance?.availableLabel || overview.balance?.availableLabel || "—"}
              hint={
                balance?.pendingLabel || overview.balance?.pendingLabel
                  ? `Pending ${balance?.pendingLabel || overview.balance?.pendingLabel}`
                  : undefined
              }
            />
            <Kpi
              title="Net · 30 days"
              value={overview.volume?.net30Label || "—"}
              hint={`Gross ${overview.volume?.gross30Label || "—"} · refunds ${overview.volume?.refunded30Label || "—"}`}
            />
            <Kpi
              title="MRR"
              value={overview.mrr?.label || "—"}
              hint={`${overview.mrr?.activeSubscriptions ?? 0} active subs`}
            />
            <Kpi
              title="Last bank payout"
              value={overview.lastBankPayout?.amountLabel || "—"}
              hint={
                overview.lastBankPayout
                  ? `${overview.lastBankPayout.status} · arrive ${fmtDay(overview.lastBankPayout.arrivalDate)}`
                  : "None listed yet"
              }
            />
          </div>
          <div className="card space-y-2 p-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--text)]">Quick actions</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <button type="button" className="text-accent hover:underline" onClick={() => setTab("share")}>
                  Share tab — send partner pool to Connect Stripe
                </button>
              </li>
              <li>
                <button type="button" className="text-accent hover:underline" onClick={() => setTab("charges")}>
                  Charges &amp; refunds
                </button>
              </li>
              <li>
                <button type="button" className="text-accent hover:underline" onClick={() => setTab("bank")}>
                  Platform bank payout history
                </button>
              </li>
              <li>
                <Link href="/admin/members" className="text-accent hover:underline">
                  Mark Venmo paid (Members)
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}

      {tab === "overview" && !loading && !isPlatform && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              title={`${selectedAccount?.label || "Partner"} available`}
              value={balance?.availableLabel || "—"}
              hint={balance?.pendingLabel ? `Pending ${balance.pendingLabel}` : balance?.error || undefined}
            />
            <Kpi
              title="Last share received"
              value={shareRows[0]?.amountLabel || "—"}
              hint={shareRows[0] ? fmtDate(shareRows[0].createdAt) : "No transfers yet"}
            />
            <Kpi
              title="Last bank payout"
              value={bankRows[0]?.amountLabel || "—"}
              hint={
                bankRows[0]
                  ? `${bankRows[0].status} · ${fmtDay(bankRows[0].arrivalDate)}`
                  : "They control bank push in Express"
              }
            />
          </div>
          {selectedAccount?.partnerId && (
            <div className="card flex flex-wrap gap-2 p-4">
              {selectedAccount.stripeAccountId ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={Boolean(busy)}
                  onClick={() => void openExpressDashboard(selectedAccount.partnerId!)}
                >
                  Open Express dashboard (bank) ↗
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={Boolean(busy)}
                  onClick={() => void startConnect(selectedAccount.partnerId!)}
                >
                  Start Connect onboarding
                </button>
              )}
              <button type="button" className="btn-ghost text-xs" onClick={() => setTab("share")}>
                View inbound share transfers
              </button>
            </div>
          )}
          {balance?.error && (
            <p className="text-sm text-amber-200">{balance.error}</p>
          )}
        </div>
      )}

      {/* BALANCE */}
      {tab === "balance" && !loading && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi title="Available" value={balance?.availableLabel || "—"} />
            <Kpi title="Pending" value={balance?.pendingLabel || "—"} />
          </div>
          {balance?.error && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {balance.error}
            </p>
          )}
          {balance?.currencies && balance.currencies.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2">Available</th>
                    <th className="px-3 py-2">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.currencies.map((c) => (
                    <tr key={c.currency} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-3 font-mono uppercase">{c.currency}</td>
                      <td className="px-3 py-3 font-semibold">{c.availableLabel}</td>
                      <td className="px-3 py-3 text-[var(--muted)]">{c.pendingLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-[var(--muted)]">
            Bank payouts are listed on the Bank tab (read-only). Schedule is controlled in Stripe
            Dashboard / Express.
          </p>
        </div>
      )}

      {/* ACTIVITY */}
      {tab === "activity" && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["all", "charge", "refund", "payout", "transfer", "stripe_fee", "payment"].map((f) => (
              <button
                key={f}
                type="button"
                className={`btn-ghost text-xs ${activityFilter === f ? "ring-1 ring-accent" : ""}`}
                onClick={() => setActivityFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivity.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 align-top">
                    <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                      <div className="font-mono text-[10px] opacity-70">{r.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      {statusPill(r.type, r.type.includes("refund") || r.type.includes("payout") ? "warn" : "muted")}
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{r.amountLabel}</td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">{r.feeLabel}</td>
                    <td className="px-3 py-3 tabular-nums">{r.netLabel}</td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">
                      {r.description || r.sourceId || "—"}
                    </td>
                  </tr>
                ))}
                {filteredActivity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                      No balance activity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BANK PAYOUTS */}
      {tab === "bank" && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--text)]">Bank payouts</strong> = this Stripe account → bank.
            Read-only here.{" "}
            {isPlatform
              ? "Jeremy manages schedule in Stripe Dashboard."
              : "Partner manages push in their Express dashboard."}
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Arrive</th>
                  <th className="px-3 py-2">Destination</th>
                </tr>
              </thead>
              <tbody>
                {bankRows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                      <div className="font-mono text-[10px]">{r.id}</div>
                    </td>
                    <td className="px-3 py-3 font-semibold">{r.amountLabel}</td>
                    <td className="px-3 py-3">
                      {statusPill(
                        r.automatic ? `${r.status} · auto` : r.status,
                        r.status === "paid" ? "ok" : r.status === "failed" ? "bad" : "warn",
                      )}
                      {r.failureMessage && (
                        <p className="mt-1 text-[10px] text-rose-300">{r.failureMessage}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">{fmtDay(r.arrivalDate)}</td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">{r.destinationLabel || "—"}</td>
                  </tr>
                ))}
                {bankRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                      No bank payouts listed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isPlatform && selectedAccount?.partnerId && selectedAccount.stripeAccountId && (
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={Boolean(busy)}
              onClick={() => void openExpressDashboard(selectedAccount.partnerId!)}
            >
              Open Express dashboard to pay out to bank ↗
            </button>
          )}
        </div>
      )}

      {/* SHARE */}
      {tab === "share" && !loading && (
        <div className="space-y-6">
          <div className="card space-y-2 p-4 text-sm">
            <p className="font-medium text-[var(--text)]">
              Share = platform → partner Stripe (not bank)
            </p>
            <p className="text-[var(--muted)]">
              After share lands in Connect, the partner opens Express to push to their bank when
              ready.
            </p>
          </div>

          {isPlatform && commission && (
            <div className="card space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    Partner pool · {commission.periodSuggested}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{commission.commission.totalLabel}</p>
                  <p className="text-xs text-[var(--muted)]">
                    MRR {commission.mrr.label} · {commission.mrr.activeSubscriptions} subs
                    {commission.payoutMinimum
                      ? commission.payoutMinimum.met
                        ? ` · floor met (${commission.payoutMinimum.label})`
                        : ` · need ${commission.payoutMinimum.shortfallLabel} more for floor`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => void runPartnerShare(true)}
                  >
                    {busy === "share-dry" ? "…" : "Preview share"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (
                        confirm(
                          `Transfer partner pool for ${commission.periodSuggested} into partner Connect Stripe accounts?`,
                        )
                      ) {
                        void runPartnerShare(false);
                      }
                    }}
                  >
                    {busy === "share-run" ? "…" : "Run share → Connect"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => void runAdminFee(true)}
                  >
                    Preview admin fee
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (confirm("Transfer platform admin fee via Connect?")) {
                        void runAdminFee(false);
                      }
                    }}
                  >
                    Run admin fee
                  </button>
                </div>
              </div>

              {commission.projectedSplits?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase text-[var(--muted)]">
                        <th className="py-2">Partner</th>
                        <th className="py-2">Share</th>
                        <th className="py-2">Projected</th>
                        <th className="py-2">Connect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commission.projectedSplits.map((s) => {
                        const p = commission.partners.find((x) => x.id === s.partnerId);
                        return (
                          <tr key={s.partnerId} className="border-b border-[var(--border)] last:border-0">
                            <td className="py-2 font-medium">{s.partnerName}</td>
                            <td className="py-2 text-[var(--muted)]">{s.sharePercent}%</td>
                            <td className="py-2">{s.amountLabel}</td>
                            <td className="py-2">
                              {p?.connect?.payoutsEnabled
                                ? statusPill("ready", "ok")
                                : p?.stripeAccountId
                                  ? statusPill("onboarding", "warn")
                                  : statusPill("not linked", "bad")}
                              {p && (
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {!p.stripeAccountId ? (
                                    <button
                                      type="button"
                                      className="text-xs text-accent hover:underline"
                                      onClick={() => void startConnect(p.id)}
                                    >
                                      Connect
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-xs text-accent hover:underline"
                                      onClick={() => void openExpressDashboard(p.id)}
                                    >
                                      Express dashboard
                                    </button>
                                  )}
                                  {p.stripeAccountId && (
                                    <button
                                      type="button"
                                      className="text-xs text-accent hover:underline"
                                      onClick={() => setAccount(p.stripeAccountId!)}
                                    >
                                      View their balance
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-[var(--muted)]">
                Add partners, adjust shares, or schedule:{" "}
                <Link href="/admin/commission" className="text-accent hover:underline">
                  Partner desk
                </Link>
                .
              </p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              {isPlatform ? "Outbound share transfers" : "Inbound share transfers"}
            </h3>
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {shareRows.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                        {fmtDate(r.createdAt)}
                        <div className="font-mono text-[10px]">{r.id}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {r.amountLabel}
                        {r.reversed ? (
                          <span className="ml-2 text-[10px] text-rose-300">reversed</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[var(--muted)]">
                        {r.destinationAccountId || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted)]">{r.description || "—"}</td>
                    </tr>
                  ))}
                  {shareRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                        No share transfers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CHARGES */}
      {tab === "charges" && isPlatform && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input max-w-sm text-sm"
              placeholder="Search email, charge id, plan, last4…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="text-xs text-[var(--muted)]">{filteredTxs.length} shown</span>
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 align-top">
                    <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                      {fmtDate(t.createdAt)}
                      <div className="font-mono text-[10px] opacity-70">{t.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{t.customerName || t.customerEmail || "—"}</div>
                      {t.customerEmail && t.customerName && (
                        <div className="text-xs text-[var(--muted)]">{t.customerEmail}</div>
                      )}
                      {t.memberPlan && (
                        <div className="text-[10px] uppercase tracking-wide text-accent">{t.memberPlan}</div>
                      )}
                      {t.description && (
                        <div className="mt-0.5 text-xs text-[var(--muted)]">{t.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-semibold">{t.amountLabel}</div>
                      {(t.refunded || t.partiallyRefunded) && (
                        <div className="text-xs text-rose-300">
                          −{t.refundedLabel} · net {t.netLabel}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {t.refunded
                        ? statusPill("refunded", "warn")
                        : t.partiallyRefunded
                          ? statusPill("partial refund", "warn")
                          : t.paid
                            ? statusPill(t.status, "ok")
                            : statusPill(t.status, "bad")}
                      {t.failureMessage && (
                        <p className="mt-1 max-w-[12rem] text-[10px] text-rose-300">{t.failureMessage}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--muted)]">
                      {t.cardBrand || t.cardLast4
                        ? `${t.cardBrand || "card"} ···· ${t.cardLast4 || ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {t.refundableCents > 0 && (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-rose-300 hover:text-rose-200"
                          onClick={() => {
                            setRefundTarget(t);
                            setRefundMode("full");
                            setRefundDollars((t.refundableCents / 100).toFixed(2));
                            setRefundNote("");
                            setRefundMsg("");
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredTxs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                      No charges in this sample.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "refunds" && isPlatform && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Refund</th>
                <th className="px-3 py-2">Charge</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--muted)]">{r.chargeId || "—"}</td>
                  <td className="px-3 py-3 font-semibold">{r.amountLabel}</td>
                  <td className="px-3 py-3">
                    {statusPill(r.status, r.status === "succeeded" ? "ok" : "warn")}
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{r.reason || "—"}</td>
                </tr>
              ))}
              {refunds.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                    No refunds yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "discounts" && isPlatform && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            Also available as{" "}
            <Link href="/admin/discounts" className="text-accent hover:underline">
              Discounts
            </Link>
            .
          </p>
          <AdminDiscountsPanel />
        </div>
      )}

      {tab === "subscriptions" && isPlatform && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Period end</th>
                <th className="px-3 py-2">Id</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-3">
                    <div className="font-medium">{s.customerName || s.customerEmail || "—"}</div>
                    {s.customerEmail && s.customerName && (
                      <div className="text-xs text-[var(--muted)]">{s.customerEmail}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {s.planLabel}
                    {s.amountLabel ? (
                      <div className="text-[var(--muted)]">
                        {s.amountLabel}
                        {s.interval ? ` / ${s.interval}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {statusPill(
                      s.cancelAtPeriodEnd ? `${s.status} · canceling` : s.status,
                      s.status === "active" ? "ok" : s.status === "past_due" ? "warn" : "muted",
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{fmtDate(s.currentPeriodEnd)}</td>
                  <td className="px-3 py-3 font-mono text-[10px] text-[var(--muted)]">{s.id}</td>
                </tr>
              ))}
              {subs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                    No subscriptions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Refund modal */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRefundTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-5 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
              Issue refund
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {refundTarget.customerEmail || refundTarget.id}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Charged {refundTarget.amountLabel}
              {refundTarget.amountRefundedCents > 0
                ? ` · already refunded ${refundTarget.refundedLabel}`
                : ""}
              . Refundable{" "}
              <strong className="text-[var(--text)]">
                ${(refundTarget.refundableCents / 100).toFixed(2)}
              </strong>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={`btn-ghost text-xs ${refundMode === "full" ? "ring-1 ring-accent" : ""}`}
                onClick={() => setRefundMode("full")}
              >
                Full remaining
              </button>
              <button
                type="button"
                className={`btn-ghost text-xs ${refundMode === "partial" ? "ring-1 ring-accent" : ""}`}
                onClick={() => setRefundMode("partial")}
              >
                Partial
              </button>
            </div>
            {refundMode === "partial" && (
              <label className="mt-3 block text-xs text-[var(--muted)]">
                Amount (USD)
                <input
                  className="input mt-1 w-full"
                  value={refundDollars}
                  onChange={(e) => setRefundDollars(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            )}
            <label className="mt-3 block text-xs text-[var(--muted)]">
              Reason
              <select
                className="input mt-1 w-full"
                value={refundReason}
                onChange={(e) =>
                  setRefundReason(e.target.value as typeof refundReason)
                }
              >
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-[var(--muted)]">
              Note (optional)
              <input
                className="input mt-1 w-full"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
              />
            </label>
            {refundMsg && <p className="mt-2 text-xs text-rose-300">{refundMsg}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => setRefundTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy === "refund"}
                onClick={() => void submitRefund()}
              >
                {busy === "refund" ? "Working…" : "Submit refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
