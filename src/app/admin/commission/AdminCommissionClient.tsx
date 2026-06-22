"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type CommissionResponse = {
  enabled: boolean;
  periodSuggested: string;
  mrr: { cents: number; label: string; activeSubscriptions: number };
  commission: {
    totalCommissionCents: number;
    totalLabel: string;
    tier1BaseCents: number;
    tier1CommissionCents: number;
    tier2BaseCents: number;
    tier2CommissionCents: number;
    tier1CapLabel: string;
    tier1RatePercent: number;
    tier2RatePercent: number;
  };
  partner: {
    configured: boolean;
    accountId: string | null;
    email: string | null;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
  };
  payouts: Array<{
    period: string;
    totalCommissionCents: number;
    mrrCents: number;
    status: string;
    paidAt: string | null;
    transferId: string | null;
    error: string | null;
  }>;
};

function centsToUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

export default function AdminCommissionClient() {
  const searchParams = useSearchParams();
  const connectNotice = searchParams.get("connect");
  const [data, setData] = useState<CommissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/commission");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not load commission data.");
      setData(null);
    } else {
      setData(body);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startConnect() {
    setBusy("connect");
    setError("");
    const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error || "Connect onboarding failed.");
    setBusy(null);
  }

  async function openPartnerDashboard() {
    setBusy("dashboard");
    setError("");
    const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.open(body.url, "_blank", "noopener,noreferrer");
    } else {
      setError(body.error || "Could not open partner dashboard.");
    }
    setBusy(null);
  }

  async function runPayout(dryRun: boolean) {
    setBusy(dryRun ? "dry" : "payout");
    setError("");
    const res = await fetch("/api/stripe/commission/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period: data?.periodSuggested,
        dryRun,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Payout failed.");
    } else {
      await load();
    }
    setBusy(null);
  }

  const tier1Pct =
    data && data.mrr.cents > 0
      ? Math.min(100, (data.commission.tier1BaseCents / data.mrr.cents) * 100)
      : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commission split</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Partner commission on membership MRR — {data?.commission.tier1RatePercent ?? 5}% on the
          first {data?.commission.tier1CapLabel ?? "$5,000"}, then{" "}
          {data?.commission.tier2RatePercent ?? 30}% above that. Paid monthly via Stripe Connect.
        </p>
      </div>

      {connectNotice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {connectNotice === "return"
            ? "Stripe Connect onboarding submitted — refresh status below."
            : "Resume Connect onboarding if needed."}
        </p>
      )}

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : data ? (
        <>
          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              Partner Connect (John)
            </h2>
            {data.partner.configured && data.partner.accountId ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-[var(--muted)]">Account:</span>{" "}
                  <code className="text-xs">{data.partner.accountId}</code>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Onboarding:</span>{" "}
                  {data.partner.detailsSubmitted ? (
                    <span className="text-emerald-300">Complete</span>
                  ) : (
                    <span className="text-amber-300">Incomplete</span>
                  )}
                  {" · "}
                  <span className="text-[var(--muted)]">Payouts:</span>{" "}
                  {data.partner.payoutsEnabled ? (
                    <span className="text-emerald-300">Enabled</span>
                  ) : (
                    <span className="text-amber-300">Pending</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={busy !== null}
                    onClick={() => void openPartnerDashboard()}
                  >
                    {busy === "dashboard" ? "…" : "Open partner Stripe dashboard"}
                  </button>
                  {!data.partner.detailsSubmitted && (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy !== null}
                      onClick={() => void startConnect()}
                    >
                      Resume onboarding
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Link your Stripe Express account to receive monthly commission transfers from
                  Jeremy&apos;s Train Station Stripe balance.
                </p>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy !== null}
                  onClick={() => void startConnect()}
                >
                  {busy === "connect" ? "Starting…" : "Connect my Stripe account"}
                </button>
              </div>
            )}
          </div>

          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              Current MRR snapshot
            </h2>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold">{data.mrr.label}</div>
                <div className="text-xs text-[var(--muted)]">
                  {data.mrr.activeSubscriptions} active subscription
                  {data.mrr.activeSubscriptions === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[2px] text-[var(--muted)]">
                  This month&apos;s commission
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {data.commission.totalLabel}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="bg-emerald-500/70"
                  style={{ width: `${tier1Pct}%` }}
                  title="Tier 1 (5%)"
                />
                <div
                  className="bg-violet-500/70"
                  style={{ width: `${100 - tier1Pct}%` }}
                  title="Tier 2 (30%)"
                />
              </div>
              <div className="grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                <div>
                  Tier 1 ({data.commission.tier1RatePercent}% up to {data.commission.tier1CapLabel}
                  ): {centsToUsd(data.commission.tier1CommissionCents)} on{" "}
                  {centsToUsd(data.commission.tier1BaseCents)} MRR
                </div>
                <div>
                  Tier 2 ({data.commission.tier2RatePercent}% above cap):{" "}
                  {centsToUsd(data.commission.tier2CommissionCents)} on{" "}
                  {centsToUsd(data.commission.tier2BaseCents)} MRR
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              Monthly payout
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Runs a Stripe Transfer to the partner account for period{" "}
              <strong className="text-white">{data.periodSuggested}</strong> using the current MRR
              snapshot. Schedule via Vercel Cron or run manually after month-end.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                disabled={busy !== null}
                onClick={() => void runPayout(true)}
              >
                {busy === "dry" ? "…" : "Preview payout"}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy !== null || !data.partner.payoutsEnabled}
                onClick={() => void runPayout(false)}
              >
                {busy === "payout" ? "Transferring…" : "Run payout now"}
              </button>
            </div>
          </div>

          {data.payouts.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Commission</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p) => (
                    <tr key={p.period} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3">{p.period}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{centsToUsd(p.mrrCents)}</td>
                      <td className="px-4 py-3">{centsToUsd(p.totalCommissionCents)}</td>
                      <td className="px-4 py-3 capitalize">
                        {p.status}
                        {p.error ? (
                          <span className="block text-[10px] text-amber-400">{p.error}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}