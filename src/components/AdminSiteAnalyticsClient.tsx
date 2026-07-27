"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Overview = {
  storage: "database" | "demo";
  pageViews: number;
  pageClicks: number;
  uniqueSessions: number;
  topPages: Array<{ path: string; views: number }>;
  topClicks: Array<{ label: string; path: string; clicks: number }>;
  payments: { count: number; revenueCents: number };
  sections?: {
    landing: number;
    member: number;
    admin: number;
    auth: number;
    other: number;
  };
  newSignups?: number;
  activeUsers?: number;
  databaseConfigured?: boolean;
  periodDays?: number;
};

const PERIODS = [7, 14, 30, 90] as const;

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

export default function AdminSiteAnalyticsClient() {
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
        setError(body.detail || body.error || "Could not load analytics");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = data?.sections;
  const sectionTotal = sections
    ? sections.landing + sections.member + sections.admin + sections.auth + sections.other
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Site Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Traffic, engagement, signups, and what people click — from the live site tracker (and
            payment facts when Postgres is connected).
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
              label="New signups"
              value={data.newSignups ?? 0}
              hint="Member accounts created"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Active users (tracked)"
              value={data.activeUsers ?? 0}
              hint="Distinct user ids with events"
            />
            <MetricCard
              label="Payments (facts)"
              value={data.payments.count}
              hint={
                data.payments.revenueCents > 0
                  ? `${formatMoney(data.payments.revenueCents)} revenue`
                  : "Stripe payment facts when webhooks write DB"
              }
            />
            <MetricCard
              label="Views / session"
              value={
                data.uniqueSessions > 0
                  ? (data.pageViews / data.uniqueSessions).toFixed(1)
                  : "—"
              }
            />
            <MetricCard
              label="Clicks / session"
              value={
                data.uniqueSessions > 0
                  ? (data.pageClicks / data.uniqueSessions).toFixed(1)
                  : "—"
              }
            />
          </div>

          {sections && sectionTotal > 0 ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Traffic by area</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {(
                  [
                    ["Landing", sections.landing],
                    ["Member", sections.member],
                    ["Admin", sections.admin],
                    ["Auth", sections.auth],
                    ["Other", sections.other],
                  ] as const
                ).map(([label, n]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {label}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">{n}</p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {sectionTotal ? Math.round((n / sectionTotal) * 100) : 0}%
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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

          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/admin/accounting" className="btn-ghost px-3 py-2">
              Accounting
            </Link>
            <Link href="/admin/reports" className="btn-ghost px-3 py-2">
              Reports
            </Link>
            <Link href="/admin/members" className="btn-ghost px-3 py-2">
              Members
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
