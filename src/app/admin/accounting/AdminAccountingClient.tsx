"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminBooksPanel from "./AdminBooksPanel";

type QueueItem = {
  id: string;
  payee: string;
  kindLabel: string;
  amountLabel: string;
  status: string;
  statusLabel: string;
  detail: string;
  blockedReason: string | null;
  processable: boolean;
};

type AccountingData = {
  generatedAt: string;
  testMode: boolean;
  commissionEnabled: boolean;
  stripeBalance: {
    configured: boolean;
    testMode: boolean;
    availableLabel: string | null;
    pendingLabel: string | null;
    error: string | null;
  };
  volume: {
    gross30Label: string;
    net30Label: string;
    gross7Label: string;
    refunded30Label: string;
  };
  mrr: { label: string; activeSubscriptions: number; cents: number };
  members: {
    activeMemberUsers: number;
    totalProfiles: number;
    payingMembers: number;
    pendingPayment: number;
    freeExplorer: number;
    staffGrants: number;
    unpaidButOnboarded: number;
    byPlan: Record<string, number>;
  };
  payoutMinimum: {
    label: string;
    met: boolean;
    shortfallLabel: string;
    poolLabel: string;
  };
  projectedSplits: Array<{
    partnerId: string;
    partnerName: string;
    sharePercent: number;
    amountLabel: string;
  }>;
  companyFeed: {
    sharePercent: number;
    amountLabel: string;
    label: string;
  } | null;
  paymentQueue: QueueItem[];
  recentPayouts: Array<{
    period: string;
    status: string;
    totalLabel: string;
    mrrLabel: string;
    paidAt: string | null;
    error: string | null;
  }>;
  partnerShare: {
    mode: string;
    shareTotal: number;
    shareValid: boolean;
    shareMessage: string | null;
    periodSuggested: string;
  };
  payoutSchedule?: {
    mode: string;
    weekdayLabel: string;
  };
  paymentBooks?: {
    count: number;
    totalPaidLabel: string;
    totalPaidCents: number;
    rows: Array<{
      id: string;
      amountLabel: string;
      status: string;
      planId: string | null;
      billingReason: string | null;
      paidAt: string;
      memberName: string | null;
      memberEmail: string | null;
      userId: string | null;
    }>;
  };
  links: {
    moneyDesk: string;
    billing: string;
    discounts: string;
    members: string;
  };
};

function Kpi({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string | number;
  hint?: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-[var(--text)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

type DeskTab = "overview" | "books";

export default function AdminAccountingClient() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [deskTab, setDeskTab] = useState<DeskTab>(() =>
    tabParam === "books" ? "books" : "overview",
  );
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounting/overview", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not load accounting.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load accounting.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabParam === "books") setDeskTab("books");
    else if (tabParam === "overview") setDeskTab("overview");
  }, [tabParam]);

  if (loading && deskTab === "overview") {
    return <p className="text-sm text-[var(--muted)]">Loading accounting desk…</p>;
  }

  if ((error || !data) && deskTab === "overview") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error || "No data."}
        <button type="button" className="btn-ghost ml-3 text-xs" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  const bal = data?.stripeBalance;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounting</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            {deskTab === "books"
              ? "In-app general ledger (QuickBooks-style). Chart, journals, trial balance."
              : "Executive rollup and partner minimums. Open Books for the double-entry ledger."}
            {" · "}
            <Link href="/admin/billing" className="text-accent hover:underline">
              Stripe money
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.testMode ? (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
              Stripe Test mode
            </span>
          ) : data ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
              Stripe Live
            </span>
          ) : null}
          {deskTab === "overview" ? (
            <button type="button" className="btn-ghost text-xs" onClick={() => void load()}>
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
        {(
          [
            { id: "overview" as const, label: "Overview" },
            { id: "books" as const, label: "Books (GL)" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDeskTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              deskTab === t.id
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {deskTab === "books" ? <AdminBooksPanel /> : null}

      {deskTab === "overview" && data && bal ? (
        <div className="space-y-8">

      {/* Balance + minimums */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Balance & minimums
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/billing?tab=balance" className="block transition hover:opacity-90">
            <Kpi
              title="Stripe available"
              value={bal.availableLabel || "—"}
              hint={
                bal.error
                  ? bal.error
                  : bal.pendingLabel
                    ? `Pending ${bal.pendingLabel} · open Stripe money`
                    : "Open Stripe money → Balance"
              }
              tone={bal.error ? "warn" : "ok"}
            />
          </Link>
          <Kpi
            title="Stripe pending"
            value={bal.pendingLabel || "—"}
            hint="In flight to available"
          />
          <Kpi
            title="Payout minimum"
            value={data.payoutMinimum.label}
            hint={
              data.payoutMinimum.met
                ? `Pool ${data.payoutMinimum.poolLabel} · met`
                : `Need ${data.payoutMinimum.shortfallLabel} more in partner pool`
            }
            tone={data.payoutMinimum.met ? "ok" : "warn"}
          />
          <Kpi
            title="Partner pool (projected)"
            value={data.payoutMinimum.poolLabel}
            hint={`Period ${data.partnerShare.periodSuggested} · ${data.partnerShare.mode} mode`}
          />
        </div>
      </section>

      {/* Revenue + members */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Revenue & members
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            title="MRR"
            value={data.mrr.label}
            hint={`${data.mrr.activeSubscriptions} active Stripe subs`}
          />
          <Kpi title="Net 30d" value={data.volume.net30Label} hint={`Gross ${data.volume.gross30Label}`} />
          <Kpi
            title="Paying members"
            value={data.members.payingMembers}
            hint={`${data.members.activeMemberUsers} active accounts`}
            tone="ok"
          />
          <Kpi
            title="Pending payment"
            value={data.members.pendingPayment}
            hint={
              data.members.unpaidButOnboarded
                ? `${data.members.unpaidButOnboarded} finished setup unpaid`
                : "Awaiting card / Venmo mark-paid"
            }
            tone={data.members.pendingPayment > 0 ? "warn" : "muted"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi title="Free / Explorer" value={data.members.freeExplorer} />
          <Kpi title="Staff grants" value={data.members.staffGrants} hint="Manual comp access" />
          <Kpi
            title="Gross 7d"
            value={data.volume.gross7Label}
            hint={`Refunds 30d ${data.volume.refunded30Label}`}
          />
        </div>
        {Object.keys(data.members.byPlan).length > 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Profiles by plan
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {Object.entries(data.members.byPlan).map(([plan, n]) => (
                <li
                  key={plan}
                  className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium"
                >
                  {plan}: <span className="tabular-nums text-accent">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Projected payouts */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Projected payouts
          </h2>
          <Link href={data.links.moneyDesk} className="text-xs font-semibold text-accent hover:underline">
            Open Money desk →
          </Link>
        </div>
        {data.companyFeed ? (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-sm">
            <span className="font-semibold text-violet-100">{data.companyFeed.label}</span>
            <span className="ml-2 tabular-nums text-[var(--text)]">
              {data.companyFeed.amountLabel}
            </span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              ({data.companyFeed.sharePercent}% retained on master)
            </span>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Partner</th>
                <th className="px-3 py-2 font-semibold">Share</th>
                <th className="px-3 py-2 font-semibold">Projected</th>
              </tr>
            </thead>
            <tbody>
              {data.projectedSplits.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-[var(--muted)]">
                    No partner splits configured yet.
                  </td>
                </tr>
              ) : (
                data.projectedSplits.map((s) => (
                  <tr key={s.partnerId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2.5 font-medium">{s.partnerName}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">
                      {s.sharePercent}%
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{s.amountLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!data.partnerShare.shareValid && data.partnerShare.shareMessage ? (
          <p className="text-xs text-amber-200">{data.partnerShare.shareMessage}</p>
        ) : null}
        {data.payoutSchedule ? (
          <p className="text-xs text-[var(--muted)]">
            Schedule: {data.payoutSchedule.mode}
            {data.payoutSchedule.mode === "weekly"
              ? ` · ${data.payoutSchedule.weekdayLabel}`
              : " · on demand"}
          </p>
        ) : null}
      </section>

      {/* Payment queue snapshot */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Payment queue (snapshot)
        </h2>
        <ul className="space-y-2">
          {(data.paymentQueue || []).map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.payee}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {item.kindLabel} · {item.detail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums font-semibold">{item.amountLabel}</p>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wide ${
                      item.status === "ready"
                        ? "text-emerald-300"
                        : item.status === "blocked"
                          ? "text-amber-300"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {item.statusLabel}
                  </p>
                </div>
              </div>
              {item.blockedReason ? (
                <p className="mt-1 text-xs text-amber-200/90">{item.blockedReason}</p>
              ) : null}
            </li>
          ))}
          {(data.paymentQueue || []).length === 0 ? (
            <li className="text-sm text-[var(--muted)]">Queue empty for this period.</li>
          ) : null}
        </ul>
      </section>

      {/* App books — Postgres ledger (membership + Venmo mark-paid + tips) */}
      <section className="space-y-3" id="books">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Books (app ledger)
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Postgres payment rows — Stripe checkouts, Venmo mark-paid, tips. Stays even if Stripe
              keys change.
            </p>
          </div>
          {data.paymentBooks ? (
            <p className="text-sm font-semibold tabular-nums text-emerald-300">
              {data.paymentBooks.totalPaidLabel}
              <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                · {data.paymentBooks.count} recent
              </span>
            </p>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Member</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {!data.paymentBooks?.rows?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-[var(--muted)]">
                    No ledger rows yet. New card checkouts and Mark paid (with amount) write here.
                  </td>
                </tr>
              ) : (
                data.paymentBooks.rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                      {new Date(r.paidAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{r.memberName || "—"}</p>
                      <p className="text-[11px] text-[var(--muted)]">{r.memberEmail || r.userId}</p>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{r.amountLabel}</td>
                    <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                      {r.billingReason || r.planId || "payment"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent payouts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Recent partner payouts
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-[var(--muted)]">
                    No payout runs recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentPayouts.map((p) => (
                  <tr key={p.period + (p.paidAt || "")} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2.5 font-medium">{p.period}</td>
                    <td className="px-3 py-2.5 capitalize text-[var(--muted)]">{p.status}</td>
                    <td className="px-3 py-2.5 tabular-nums">{p.totalLabel}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">{p.mrrLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4 text-xs">
        <button type="button" className="btn-primary px-3 py-2" onClick={() => setDeskTab("books")}>
          Open Books (GL)
        </button>
        <Link href={data.links.moneyDesk} className="btn-ghost px-3 py-2">
          Money desk
        </Link>
        <Link href={data.links.billing} className="btn-ghost px-3 py-2">
          Billing
        </Link>
        <Link href={data.links.members} className="btn-ghost px-3 py-2">
          Members
        </Link>
        <Link href={data.links.discounts} className="btn-ghost px-3 py-2">
          Discount codes
        </Link>
        <p className="w-full text-[10px] text-[var(--muted)]">
          Generated {new Date(data.generatedAt).toLocaleString()} · Commission{" "}
          {data.commissionEnabled ? "enabled" : "disabled"}
        </p>
      </div>
        </div>
      ) : null}
    </div>
  );
}
