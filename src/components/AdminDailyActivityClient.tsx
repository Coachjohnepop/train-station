"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatActivityTime,
  shiftUsageDate,
  todayIsoInZone,
  yesterdayIso,
  type DailyActivityReport,
  type DailyUserActivity,
  type UsageRange,
} from "@/lib/daily-user-activity-format";

function roleChip(role: string): string {
  if (role === "INSTRUCTOR") return "Coach";
  if (role === "ADMIN") return "Staff";
  if (role === "PLATFORM_ADMIN") return "Platform";
  return "";
}

function UserCard({ user }: { user: DailyUserActivity }) {
  const href = user.memberHref || "#";
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <Link href={href} className="text-lg font-semibold hover:underline">
            {user.name}
          </Link>
          <p className="text-xs text-[var(--muted)]">
            {user.email}
            {user.role === "MEMBER" ? ` · ${user.planLabel}` : null}
            {roleChip(user.role) ? ` · ${roleChip(user.role)}` : null}
            {user.device ? ` · ${user.device}` : null}
          </p>
        </div>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {user.activeDays > 1 ? `${user.activeDays} days · ` : null}
          {user.firstSeenAt ? formatActivityTime(user.firstSeenAt) : "—"}
          {user.lastSeenAt && user.lastSeenAt !== user.firstSeenAt
            ? ` – ${formatActivityTime(user.lastSeenAt)}`
            : ""}{" "}
          PT
        </p>
      </div>
      <ul className="mt-3 space-y-1 text-sm leading-relaxed">
        {user.headlines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
      {user.timeline.length ? (
        <ol className="mt-3 max-h-44 space-y-1 overflow-y-auto border-t border-[var(--border)]/70 pt-2 text-xs">
          {user.timeline.map((row, idx) => (
            <li
              key={`${row.at}-${idx}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[var(--muted)]"
            >
              <span className="tabular-nums">{formatActivityTime(row.at)}</span>
              <span className="text-[var(--text)]">{row.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {user.pages.length ? (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Pages:{" "}
          {user.pages.map((p) => `${p.label} (${p.views})`).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

const RANGES: Array<{ id: UsageRange; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminDailyActivityClient({
  initialDate,
  initialRange = "day",
}: {
  initialDate: string;
  initialRange?: UsageRange;
}) {
  const [date, setDate] = useState(initialDate);
  const [range, setRange] = useState<UsageRange>(initialRange);
  const [data, setData] = useState<DailyActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => todayIsoInZone(), []);
  const yesterday = useMemo(() => yesterdayIso(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/activity?date=${encodeURIComponent(date)}&range=${encodeURIComponent(range)}`,
        { cache: "no-store" },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not load activity");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load activity");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URL(window.location.href);
    next.searchParams.set("date", date);
    next.searchParams.set("range", range);
    window.history.replaceState(null, "", next.pathname + next.search);
  }, [date, range]);

  const members = data?.users.filter((u) => u.role === "MEMBER") ?? [];
  const staff = data?.users.filter((u) => u.role !== "MEMBER") ?? [];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent-fg)]">
            Coaches + admins
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Usage</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Who trained this day, week, or month (Pacific). Workouts, sets, Zoom, messages, and
            guests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`min-h-10 rounded-md px-3 text-xs font-semibold ${
                  range === r.id ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
                }`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost min-h-11 px-3 text-xs"
            onClick={() => setDate(shiftUsageDate(date, range, -1))}
          >
            ← Prev
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          />
          <button
            type="button"
            className="btn-ghost min-h-11 px-3 text-xs"
            disabled={date >= today}
            onClick={() => setDate(shiftUsageDate(date, range, 1))}
          >
            Next →
          </button>
          <button
            type="button"
            className={`btn-ghost min-h-11 px-3 text-xs ${date === yesterday && range === "day" ? "ring-1 ring-accent" : ""}`}
            onClick={() => {
              setRange("day");
              setDate(yesterday);
            }}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={`btn-ghost min-h-11 px-3 text-xs ${date === today && range === "day" ? "ring-1 ring-accent" : ""}`}
            onClick={() => {
              setRange("day");
              setDate(today);
            }}
          >
            Today
          </button>
        </div>
      </div>

      {data ? (
        <>
          <p className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">{data.dateLabel}</span>
            {" · "}
            {data.totals.trained} trained
            {" · "}
            {data.totals.membersActive} members active
            {" · "}
            {data.totals.staffActive} staff
            {" · "}
            {data.quietMembers.length} quiet
            {" · "}
            {data.totals.guestSessions} guest sessions
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Trained", data.totals.trained],
              ["Workouts", data.totals.workoutsLogged],
              ["Sets", data.totals.setsChecked],
              ["Zoom", data.totals.zoomJoins],
              ["Messages", data.totals.messages],
              ["Signups", data.totals.signups],
              ["Paid", money(data.totals.paymentsCents)],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {label}
                </p>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {loading && !data ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          {loading ? <p className="text-xs text-[var(--muted)]">Refreshing…</p> : null}

          {members.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Members</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {members.map((user) => (
                  <UserCard key={user.userId} user={user} />
                ))}
              </div>
            </section>
          ) : (
            <p className="text-sm text-[var(--muted)]">No members were active in this window.</p>
          )}

          {staff.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Coach / staff</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {staff.map((user) => (
                  <UserCard key={user.userId} user={user} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-lg font-semibold">Guests (not signed in)</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.guests.sessions} session{data.guests.sessions === 1 ? "" : "s"} ·{" "}
              {data.guests.pageViews} page views
            </p>
            {data.guests.topPages.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {data.guests.topPages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-2">
                    <span>{p.label}</span>
                    <span className="tabular-nums text-[var(--muted)]">{p.views}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No guest hits in this window.</p>
            )}
            {data.guests.notableClicks.length ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Clicks:{" "}
                {data.guests.notableClicks.map((c) => `${c.label} (${c.count})`).join(" · ")}
              </p>
            ) : null}
          </section>

          {data.quietMembers.length ? (
            <section>
              <h2 className="text-lg font-semibold">No activity</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Members with an account who did not open the app in this window.
              </p>
              <ul className="mt-3 columns-1 gap-x-6 text-sm sm:columns-2 lg:columns-3">
                {data.quietMembers.map((m) => (
                  <li key={m.userId} className="break-inside-avoid py-0.5">
                    <Link href={m.memberHref} className="hover:underline">
                      {m.name}
                    </Link>
                    <span className="text-[var(--muted)]"> · {m.planLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-xs text-[var(--muted)]">
            Also on Station pulse for site-wide hits —{" "}
            <Link href="/admin/analytics" className="text-accent hover:underline">
              /admin/analytics
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  );
}
