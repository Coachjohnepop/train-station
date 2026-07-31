"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BalanceSnap = {
  availableLabel?: string | null;
  pendingLabel?: string | null;
  testMode?: boolean;
  error?: string | null;
  configured?: boolean;
};

type AnalyticsSnap = {
  pageViews?: number;
  uniqueSessions?: number;
  newSignups?: number;
  pageClicks?: number;
  periodDays?: number;
  storage?: string;
};

type SeoSnap = {
  seo?: {
    metaTitle?: string;
    robotsIndex?: boolean;
    updatedAt?: string;
  };
  sitemapUrl?: string;
  robotsUrl?: string;
};

const CARDS = [
  {
    href: "/admin/billing?tab=balance",
    title: "Stripe balances",
    description: "Platform + Connect available/pending, bank payouts, balance activity.",
    cta: "Open balances →",
  },
  {
    href: "/admin/billing",
    title: "Stripe money desk",
    description: "Charges, refunds, discounts, subscriptions, share transfers.",
    cta: "Open billing →",
  },
  {
    href: "/admin/accounting",
    title: "Accounting",
    description: "MRR, paying members, partner pool minimums, projected splits.",
    cta: "Open accounting →",
  },
  {
    href: "/admin/analytics",
    title: "Site Analytics",
    description: "Page views, sessions, signups, top pages & clicks from the live tracker.",
    cta: "Open analytics →",
  },
  {
    href: "/admin/seo",
    title: "SEO",
    description: "Titles, descriptions, OG share image, robots.txt, sitemap.xml.",
    cta: "Open SEO →",
  },
  {
    href: "/admin/reports",
    title: "Reports",
    description: "Engagement and activity summaries across the site.",
    cta: "View reports →",
  },
  {
    href: "/admin/commission",
    title: "Partner desk",
    description: "Connect, partner pool, platform admin fee, payout queue.",
    cta: "Open partner desk →",
  },
  {
    href: "/admin/audit",
    title: "Audit log",
    description: "Mark-paid, refunds, discounts, tips, role changes.",
    cta: "Open audit →",
  },
  {
    href: "/admin/pricing",
    title: "Membership pricing",
    description: "Coach / Business / 1st Class — site + Stripe price sync.",
    cta: "Edit pricing →",
  },
  {
    href: "/admin/users",
    title: "Users & roles",
    description: "Staff accounts, instructors, demo members.",
    cta: "Manage users →",
  },
  {
    href: "/admin/videos",
    title: "Videos",
    description: "Free gag, intros, thank-you, weekly / dinner / daily.",
    cta: "Open videos →",
  },
  {
    href: "/admin/landing",
    title: "Landing & Venmo",
    description: "Public media, Venmo QR, ticket presentation.",
    cta: "Edit landing →",
  },
];

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-violet-500/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function AdminPlatformDashboardClient() {
  const [balance, setBalance] = useState<BalanceSnap | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSnap | null>(null);
  const [seo, setSeo] = useState<SeoSnap | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [balRes, anRes, seoRes] = await Promise.all([
      fetch("/api/admin/billing/balance?account=platform", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/analytics/overview?days=7", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/seo", { cache: "no-store" }).catch(() => null),
    ]);

    if (balRes?.ok) {
      setBalance((await balRes.json()) as BalanceSnap);
    } else {
      setBalance({ error: "Could not load balance", availableLabel: null });
    }

    if (anRes?.ok) {
      setAnalytics((await anRes.json()) as AnalyticsSnap);
    } else {
      setAnalytics(null);
    }

    if (seoRes?.ok) {
      setSeo((await seoRes.json()) as SeoSnap);
    } else {
      setSeo(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform backoffice</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Stripe balances, site analytics, SEO, and commerce ops — separate from Jeremy&apos;s
            day-to-day coaching tools.
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => void load()}>
          Refresh KPIs
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Live snapshot
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading balances, analytics, SEO…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Stripe available"
              value={balance?.availableLabel || "—"}
              hint={
                balance?.error
                  ? balance.error
                  : balance?.testMode
                    ? "Test mode · platform account"
                    : "Platform account · Live"
              }
              href="/admin/billing?tab=balance"
            />
            <Kpi
              label="Stripe pending"
              value={balance?.pendingLabel || "—"}
              hint="Funds not yet available"
              href="/admin/billing?tab=balance"
            />
            <Kpi
              label="Page views (7d)"
              value={analytics?.pageViews != null ? String(analytics.pageViews) : "—"}
              hint={
                analytics
                  ? `${analytics.uniqueSessions ?? 0} sessions · ${analytics.newSignups ?? 0} signups`
                  : "Tracker overview"
              }
              href="/admin/analytics"
            />
            <Kpi
              label="SEO indexing"
              value={seo?.seo?.robotsIndex === false ? "No-index" : "Public"}
              hint={seo?.seo?.metaTitle ? seo.seo.metaTitle.slice(0, 48) : "Open SEO desk"}
              href="/admin/seo"
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Desks
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="card flex flex-col justify-between transition hover:border-[#7c3aed]/50"
            >
              <div>
                <h2 className="font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{card.description}</p>
              </div>
              <span className="mt-4 text-sm font-medium text-[#7c3aed]">{card.cta}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
