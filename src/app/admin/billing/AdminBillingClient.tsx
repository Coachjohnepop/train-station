"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDiscountsPanel from "@/components/AdminDiscountsPanel";

type Tab = "overview" | "transactions" | "refunds" | "discounts" | "subscriptions";

const VALID_TABS: Tab[] = ["overview", "transactions", "refunds", "discounts", "subscriptions"];

function tabFromParam(raw: string | null): Tab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as Tab;
  return "overview";
}

type Overview = {
  configured: boolean;
  testMode: boolean;
  publishableKeyPresent: boolean;
  message: string | null;
  balance?: {
    availableLabel: string | null;
    pendingLabel: string | null;
  };
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
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}>
      {status}
    </span>
  );
}

export default function AdminBillingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  // Refund modal
  const [refundTarget, setRefundTarget] = useState<Tx | null>(null);
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  const [refundDollars, setRefundDollars] = useState("");
  const [refundReason, setRefundReason] = useState<
    "requested_by_customer" | "duplicate" | "fraudulent"
  >("requested_by_customer");
  const [refundNote, setRefundNote] = useState("");
  const [refundMsg, setRefundMsg] = useState("");

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/admin/billing?${qs}` : "/admin/billing", { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    setTabState(tabFromParam(searchParams.get("tab")));
  }, [searchParams]);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/billing/overview", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Overview failed");
    setOverview(body);
  }, []);

  const loadTxs = useCallback(async () => {
    const res = await fetch("/api/admin/billing/transactions?limit=60", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Transactions failed");
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
    // Discounts tab owns its own fetch via AdminDiscountsPanel.
    if (tab === "discounts") {
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") await loadOverview();
      else if (tab === "transactions") await loadTxs();
      else if (tab === "refunds") await loadRefunds();
      else if (tab === "subscriptions") await loadSubs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [tab, loadOverview, loadTxs, loadRefunds, loadSubs]);

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

  async function submitRefund() {
    if (!refundTarget) return;
    setBusy(true);
    setRefundMsg("");
    let amountCents: number | null = null;
    if (refundMode === "partial") {
      const dollars = Number(refundDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setRefundMsg("Enter a partial amount in dollars.");
        setBusy(false);
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
    setBusy(false);
    if (!res.ok) {
      setRefundMsg(body.error || "Refund failed");
      return;
    }
    setRefundMsg(`Refund ${body.refund?.amountLabel || ""} created (${body.refund?.id}).`);
    setRefundTarget(null);
    await Promise.all([loadTxs(), loadRefunds(), loadOverview()]);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "refunds", label: "Refunds" },
    { id: "discounts", label: "Discounts" },
    { id: "subscriptions", label: "Subscriptions" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Stripe transactions, full &amp; partial refunds, discount codes, and subscription
            health. Development &amp; partnership fee payouts stay under{" "}
            <Link href="/admin/commission" className="text-accent hover:underline">
              Dev &amp; partnership
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={loading || busy} onClick={() => void refresh()}>
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

      {overview && (
        <div className="flex flex-wrap gap-2 text-xs">
          {statusPill(overview.testMode ? "Test mode" : "Live mode", overview.testMode ? "warn" : "ok")}
          {statusPill(overview.configured ? "Stripe connected" : "Stripe missing", overview.configured ? "ok" : "bad")}
        </div>
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

      {loading && !overview && tab === "overview" ? (
        <p className="text-sm text-[var(--muted)]">Loading billing…</p>
      ) : null}

      {tab === "overview" && overview && (
        <div className="space-y-4">
          {!overview.configured && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {overview.message || "Configure STRIPE_SECRET_KEY on Vercel to unlock this dashboard."}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi title="Net · 30 days" value={overview.volume?.net30Label || "—"} hint={`Gross ${overview.volume?.gross30Label || "—"} · refunds ${overview.volume?.refunded30Label || "—"}`} />
            <Kpi title="Gross · 7 days" value={overview.volume?.gross7Label || "—"} />
            <Kpi title="MRR" value={overview.mrr?.label || "—"} hint={`${overview.mrr?.activeSubscriptions ?? 0} active subs`} />
            <Kpi
              title="Stripe balance"
              value={overview.balance?.availableLabel || "—"}
              hint={overview.balance?.pendingLabel ? `Pending ${overview.balance.pendingLabel}` : undefined}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi title="Succeeded charges (sample)" value={String(overview.counts?.succeededCharges ?? "—")} />
            <Kpi title="Failed charges (sample)" value={String(overview.counts?.failedCharges ?? "—")} />
            <Kpi title="Open / needs action PIs" value={String(overview.counts?.openPaymentIntents ?? "—")} />
          </div>
          <div className="card space-y-2 p-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--text)]">Quick actions</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <button type="button" className="text-accent hover:underline" onClick={() => setTab("transactions")}>
                  Review charges &amp; issue refunds
                </button>
              </li>
              <li>
                <button type="button" className="text-accent hover:underline" onClick={() => setTab("discounts")}>
                  Create a discount / promo code
                </button>
              </li>
              <li>
                <Link href="/admin/commission" className="text-accent hover:underline">
                  Development &amp; partnership fees (Connect)
                </Link>
              </li>
              <li>
                <Link href="/admin/pricing" className="text-accent hover:underline">
                  Membership price catalog
                </Link>
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

      {tab === "transactions" && (
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
                      No transactions in this sample.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "refunds" && (
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
                  <td className="px-3 py-3">{statusPill(r.status, r.status === "succeeded" ? "ok" : "warn")}</td>
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

      {tab === "discounts" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            Also available in coach left nav as{" "}
            <Link href="/admin/discounts" className="text-accent hover:underline">
              Discounts
            </Link>
            .
          </p>
          <AdminDiscountsPanel />
        </div>
      )}

      {tab === "subscriptions" && (
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
              <label className="mt-3 block text-sm">
                <span className="text-[var(--muted)]">Amount (USD)</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  min={0.5}
                  step={0.01}
                  value={refundDollars}
                  onChange={(e) => setRefundDollars(e.target.value)}
                />
              </label>
            )}
            <label className="mt-3 block text-sm">
              <span className="text-[var(--muted)]">Reason</span>
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
            <label className="mt-3 block text-sm">
              <span className="text-[var(--muted)]">Internal note (optional)</span>
              <input
                className="input mt-1 w-full"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="Why we refunded…"
              />
            </label>
            {refundMsg && <p className="mt-2 text-xs text-amber-200">{refundMsg}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setRefundTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                disabled={busy}
                onClick={() => void submitRefund()}
              >
                {busy ? "Refunding…" : refundMode === "full" ? "Refund full remaining" : "Refund partial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="card space-y-1 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">{title}</p>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
