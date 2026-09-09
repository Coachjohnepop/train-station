"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AnalyticsPlaybook, Insight, InsightTone, PlanItem } from "@/lib/analytics-insights";
import { formatPct } from "@/lib/analytics-insights";

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
  live?: {
    minutes: number;
    pageViews: number;
    pageClicks: number;
    facebookViews: number;
    recent: Array<{
      at: string;
      type: string;
      path: string;
      label: string;
      facebook: boolean;
      device: string | null;
    }>;
  };
  playbook?: AnalyticsPlaybook;
};

const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
] as const;

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
      {hint ? <p className="mt-1 text-[10px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function toneClass(tone: InsightTone): string {
  if (tone === "fix") return "border-rose-400/40 bg-rose-950/35";
  if (tone === "good") return "border-emerald-400/35 bg-emerald-950/25";
  return "border-amber-400/35 bg-amber-950/20";
}

function toneLabel(tone: InsightTone): string {
  if (tone === "fix") return "Fix";
  if (tone === "good") return "Working";
  return "Watch";
}

function InsightCard({ item }: { item: Insight }) {
  return (
    <article className={`rounded-xl border p-3.5 ${toneClass(item.tone)}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
          {toneLabel(item.tone)}
        </p>
        {item.stat ? (
          <p className="text-xs font-semibold tabular-nums text-white/90">{item.stat}</p>
        ) : null}
      </div>
      <h3 className="mt-1 text-base font-semibold leading-snug text-[var(--text)]">{item.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/75">{item.body}</p>
    </article>
  );
}

function FunnelStep({
  label,
  value,
  rate,
}: {
  label: string;
  value: number;
  rate?: string;
}) {
  return (
    <div className="min-w-[5.5rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {rate ? <p className="text-[10px] text-[var(--muted)]">{rate}</p> : null}
    </div>
  );
}

function PlanRow({ item }: { item: PlanItem }) {
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/30 text-sm font-bold text-[#e9d5ff]">
          {item.priority}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-fg)]">
            {item.pillar}
          </p>
          <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
            <span className="font-semibold text-[var(--muted)]">Why. </span>
            {item.why}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
            <span className="font-semibold text-[var(--muted)]">Do. </span>
            {item.doNext}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/70">
            <span className="font-semibold text-[var(--accent-fg)]">How we know. </span>
            {item.test}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function AdminSiteAnalyticsClient() {
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(7);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics/overview?days=${days}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail || body.error || "Could not load analytics");
        if (!silent) setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load analytics");
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const playbook = data?.playbook;
  const funnel = playbook?.funnel;
  const sections = data?.sections;
  const sectionTotal = sections
    ? sections.landing + sections.member + sections.admin + sections.auth + sections.other
    : 0;
  const guestClicks = (data?.topClicks ?? []).filter(
    (row) => row.label.length <= 60 && !/^set \d+$/i.test(row.label),
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent-fg)]">
            Coaches + admins
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Station pulse</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Where the site can be better, more effective, and more fun — from live hits, not vibes.
          </p>
        </div>
        <div className="flex w-full gap-1 rounded-xl border border-[var(--border)] p-1 sm:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-bold sm:flex-none ${
                days === p.days
                  ? "bg-accent/25 text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {data?.live ? (
        <section className="rounded-xl border border-sky-500/35 bg-sky-950/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-sky-100">Live — last hour</h2>
            <p className="text-[10px] text-[var(--muted)]">Refreshes every 15s</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MetricCard label="Views" value={data.live.pageViews} />
            <MetricCard label="Clicks" value={data.live.pageClicks} />
            <MetricCard
              label="Facebook"
              value={data.live.facebookViews}
              hint="referrer or fbclid"
            />
          </div>
          {data.live.recent.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No events in the last hour yet.</p>
          ) : (
            <ol className="mt-3 max-h-52 space-y-1 overflow-y-auto text-xs">
              {data.live.recent.map((row, idx) => (
                <li
                  key={`${row.at}-${idx}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--border)]/60 py-1 last:border-0"
                >
                  <span className="tabular-nums text-[var(--muted)]">
                    {new Date(row.at).toLocaleTimeString("en-US", {
                      timeZone: "America/Los_Angeles",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {row.facebook ? (
                    <span className="font-bold uppercase tracking-wide text-sky-300">FB</span>
                  ) : null}
                  <span className="text-[var(--muted)]">{row.device || ""}</span>
                  <span className="font-medium">{row.type === "page_click" ? "click" : "view"}</span>
                  <span className="font-mono text-[10px]">{row.path}</span>
                  {row.label ? (
                    <span className="min-w-0 truncate text-[var(--text)]">{row.label}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {loading && !data ? <p className="text-sm text-[var(--muted)]">Loading pulse…</p> : null}
      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-[var(--muted)]">
            Last {data.periodDays ?? days} day{(data.periodDays ?? days) === 1 ? "" : "s"} ·{" "}
            <span className="font-medium text-[var(--text)]">{data.storage}</span>
            {loading ? " · refreshing…" : null}
          </p>

          {funnel ? (
            <section>
              <h2 className="text-sm font-semibold">Guest boarding</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Homepage → tickets → signup → account. Member set-checks are not in this row.
              </p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <FunnelStep label="Home" value={funnel.homepageViews} />
                <FunnelStep
                  label="Start membership"
                  value={funnel.startMembership}
                  rate={formatPct(funnel.startMembership, funnel.homepageViews)}
                />
                <FunnelStep
                  label="Free Tour"
                  value={funnel.tourOpens}
                  rate={formatPct(funnel.tourOpens, funnel.homepageViews)}
                />
                <FunnelStep
                  label="Tickets"
                  value={funnel.joinViews}
                  rate={formatPct(funnel.joinViews, funnel.homepageViews)}
                />
                <FunnelStep
                  label="Signup"
                  value={funnel.signupViews}
                  rate={formatPct(funnel.signupViews, funnel.joinViews)}
                />
                <FunnelStep
                  label="Accounts"
                  value={funnel.signups}
                  rate={formatPct(funnel.signups, funnel.signupViews)}
                />
              </div>
            </section>
          ) : null}

          {playbook ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">1. Better</h2>
                <p className="text-xs text-[var(--muted)]">Friction, phones, first tap, tour bail.</p>
                {playbook.better.map((item) => (
                  <InsightCard key={item.id} item={item} />
                ))}
              </section>
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">2. Effective</h2>
                <p className="text-xs text-[var(--muted)]">Facebook → tickets → paid seat.</p>
                {playbook.effective.map((item) => (
                  <InsightCard key={item.id} item={item} />
                ))}
              </section>
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">3. Fun</h2>
                <p className="text-xs text-[var(--muted)]">Song, tour finish, class energy.</p>
                {playbook.fun.map((item) => (
                  <InsightCard key={item.id} item={item} />
                ))}
              </section>
            </div>
          ) : null}

          {playbook?.plan?.length ? (
            <section>
              <h2 className="text-lg font-semibold">Improvement plan</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Ranked. One change at a time. Each row has a pass/fail test.
              </p>
              <ol className="mt-3 space-y-3">
                {playbook.plan.map((item) => (
                  <PlanRow key={item.id} item={item} />
                ))}
              </ol>
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Page views" value={data.pageViews} />
            <MetricCard label="Clicks" value={data.pageClicks} />
            <MetricCard label="Sessions" value={data.uniqueSessions} />
            <MetricCard
              label="New signups"
              value={data.newSignups ?? 0}
              hint="Member accounts created"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Active members tracked" value={data.activeUsers ?? 0} />
            <MetricCard
              label="Payments"
              value={data.payments.count}
              hint={
                data.payments.revenueCents > 0
                  ? `${formatMoney(data.payments.revenueCents)}`
                  : "Stripe facts when webhooks write"
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

          {playbook && (playbook.devices.length > 0 || playbook.namedClicks.length > 0) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <h2 className="text-sm font-semibold">Devices & sources</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {playbook.devices.map((row) => (
                    <li key={row.key} className="flex justify-between gap-2">
                      <span className="capitalize">{row.key}</span>
                      <span className="tabular-nums text-[var(--muted)]">{row.count}</span>
                    </li>
                  ))}
                  {playbook.sources.map((row) => (
                    <li key={`src-${row.key}`} className="flex justify-between gap-2">
                      <span className="capitalize">{row.key}</span>
                      <span className="tabular-nums text-[var(--muted)]">{row.count} views</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <h2 className="text-sm font-semibold">Named guest clicks</h2>
                {playbook.namedClicks.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    No named landing actions yet.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-1.5 text-sm">
                    {playbook.namedClicks.map((row) => (
                      <li key={row.key} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate font-mono text-xs">{row.key}</span>
                        <span className="tabular-nums text-[var(--muted)]">{row.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          ) : null}

          {sections && sectionTotal > 0 ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Traffic by area</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                <p className="mt-3 text-sm text-[var(--muted)]">No page views yet.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {data.topPages.map((row) => (
                    <li
                      key={row.path}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-mono text-xs">{row.path}</span>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">{row.views}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-semibold">Top clicks (short labels)</h2>
              {guestClicks.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">No click events yet.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {guestClicks.slice(0, 12).map((row, idx) => (
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
            <Link href="/admin/day" className="btn-ghost min-h-11 px-3 py-2">
              Coach dashboard
            </Link>
            <Link href="/admin/landing" className="btn-ghost min-h-11 px-3 py-2">
              Landing
            </Link>
            <Link href="/admin/platform" className="btn-ghost min-h-11 px-3 py-2">
              Backoffice
            </Link>
            <Link href="/admin/seo" className="btn-ghost min-h-11 px-3 py-2">
              SEO
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
