"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Overview = {
  storage: "database" | "demo";
  pageViews: number;
  pageClicks: number;
  uniqueSessions: number;
  topPages: Array<{ path: string; views: number }>;
  topClicks: Array<{ label: string; path: string; clicks: number }>;
  payments: { count: number; revenueCents: number };
  databaseConfigured?: boolean;
  periodDays?: number;
};

const PERIODS = [7, 30] as const;

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export default function AdminInsightsClient() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics/overview?days=${days}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || "Could not load insights");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load insights");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Page views and clicks from the site tracker — useful for seeing what members and
            prospects actually use.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                days === p
                  ? "bg-accent/20 text-accent"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => setDays(p)}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      {error && (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <p className="text-xs text-[var(--muted)]">
            Last {data.periodDays ?? days} days · storage:{" "}
            <span className="font-medium text-[var(--text)]">{data.storage}</span>
            {data.databaseConfigured === false && (
              <span> · Postgres not active — demo event file only</span>
            )}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Page views" value={data.pageViews} />
            <MetricCard label="Clicks" value={data.pageClicks} />
            <MetricCard label="Sessions" value={data.uniqueSessions} hint="Unique session keys" />
            <MetricCard
              label="Payments"
              value={data.payments.count}
              hint={
                data.payments.revenueCents > 0
                  ? `${formatMoney(data.payments.revenueCents)} revenue`
                  : "Stripe facts when DB is live"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Top pages</h2>
              {data.topPages.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  No page views yet — browse the site while signed in to seed events.
                </p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {data.topPages.map((row) => (
                    <li
                      key={row.path}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-mono text-xs">{row.path}</span>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {row.views}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Top clicks</h2>
              {data.topClicks.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  No click events yet — buttons and links are tracked automatically.
                </p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {data.topClicks.map((row, idx) => (
                    <li
                      key={`${row.path}-${row.label}-${idx}`}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.label}</p>
                        <p className="truncate font-mono text-[10px] text-[var(--muted)]">
                          {row.path}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {row.clicks}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Raw API:{" "}
            <Link href={`/api/admin/analytics/overview?days=${days}`} className="text-accent hover:underline">
              /api/admin/analytics/overview
            </Link>
            {" · "}
            <Link href="/admin/reports" className="text-accent hover:underline">
              Classic reports
            </Link>
          </p>
        </>
      )}
    </div>
  );
}