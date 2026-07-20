"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatApiErrorDetail } from "@/lib/api-errors";

type TabKey = "day" | "week" | "month";

type DayTemplate = {
  id: string;
  name: string;
  category: string;
  versionLabel: string | null;
  notes: string | null;
  workoutId: string;
  exerciseCount?: number;
  workoutName?: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

type CyclePack = {
  id: string;
  name: string;
  description?: string | null;
  programId?: string | null;
  cycleMonth?: number | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  _count?: { days?: number; clones?: number };
  days?: { dayNumber: number; slots?: unknown[]; isDayOff?: boolean }[];
};

const TABS: { key: TabKey; label: string; blurb: string }[] = [
  {
    key: "day",
    label: "Day",
    blurb: "Single-workout templates (Gym/Home paste onto any program day).",
  },
  {
    key: "week",
    label: "Week",
    blurb: "Mon–Sun week packs saved from a program calendar week.",
  },
  {
    key: "month",
    label: "Month",
    blurb: "28-day cycle packs (M1–M28 library templates).",
  },
];

function isWeekPack(c: CyclePack): boolean {
  return /\[week-pack\]/i.test(c.description || "") || /week pack/i.test(c.name || "");
}

function recency(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function filledDays(c: CyclePack): number {
  if (!c.days?.length) return c._count?.days ?? 0;
  return c.days.filter((d) => (d.slots && (d.slots as unknown[]).length > 0) || d.isDayOff).length;
}

export default function AdminTemplateLibrary() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey | null) || "day";
  const [tab, setTab] = useState<TabKey>(
    initialTab === "week" || initialTab === "month" || initialTab === "day" ? initialTab : "day",
  );
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);
  const [cycles, setCycles] = useState<CyclePack[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedDays, setArchivedDays] = useState<DayTemplate[]>([]);
  const [archivedCycles, setArchivedCycles] = useState<CyclePack[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dayRes, cycleRes, archDayRes, archCycleRes] = await Promise.all([
        fetch("/api/workout-templates?archive=active", { cache: "no-store" }),
        fetch("/api/workout-cycles?library=1&archive=active", { cache: "no-store" }),
        fetch("/api/workout-templates?archive=archived", { cache: "no-store" }),
        fetch("/api/workout-cycles?library=1&archive=archived", { cache: "no-store" }),
      ]);
      if (dayRes.ok) {
        const list = (await dayRes.json()) as DayTemplate[];
        setDayTemplates(
          [...(Array.isArray(list) ? list : [])].sort(
            (a, b) => recency(b.createdAt || b.updatedAt) - recency(a.createdAt || a.updatedAt),
          ),
        );
      }
      if (cycleRes.ok) {
        const list = (await cycleRes.json()) as CyclePack[];
        setCycles(
          [...(Array.isArray(list) ? list : [])]
            .filter((c) => !c.programId)
            .sort(
              (a, b) => recency(b.createdAt || b.updatedAt) - recency(a.createdAt || a.updatedAt),
            ),
        );
      }
      if (archDayRes.ok) {
        const list = (await archDayRes.json()) as DayTemplate[];
        setArchivedDays(Array.isArray(list) ? list : []);
      }
      if (archCycleRes.ok) {
        const list = (await archCycleRes.json()) as CyclePack[];
        setArchivedCycles(
          (Array.isArray(list) ? list : []).filter((c) => !c.programId),
        );
      }
    } catch {
      setError("Could not load template library.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "day" || t === "week" || t === "month") setTab(t);
  }, [searchParams]);

  const weekPacks = useMemo(() => cycles.filter(isWeekPack), [cycles]);
  const monthPacks = useMemo(() => cycles.filter((c) => !isWeekPack(c)), [cycles]);
  const archivedWeek = useMemo(() => archivedCycles.filter(isWeekPack), [archivedCycles]);
  const archivedMonth = useMemo(
    () => archivedCycles.filter((c) => !isWeekPack(c)),
    [archivedCycles],
  );

  const q = filter.trim().toLowerCase();

  const filteredDays = useMemo(() => {
    if (!q) return dayTemplates;
    return dayTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.versionLabel || "").toLowerCase().includes(q),
    );
  }, [dayTemplates, q]);

  const filteredWeeks = useMemo(() => {
    if (!q) return weekPacks;
    return weekPacks.filter((c) => c.name.toLowerCase().includes(q));
  }, [weekPacks, q]);

  const filteredMonths = useMemo(() => {
    if (!q) return monthPacks;
    return monthPacks.filter((c) => c.name.toLowerCase().includes(q));
  }, [monthPacks, q]);

  function setTabAndUrl(next: TabKey) {
    setTab(next);
    setFilter("");
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
  }

  async function archiveDay(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-templates/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Archive failed");
        return;
      }
      setMessage("Day template archived.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function restoreDay(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Restore failed");
        return;
      }
      setMessage("Day template restored.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function archiveCycle(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-cycles/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Archive failed");
        return;
      }
      setMessage("Pack archived.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function restoreCycle(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout-cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(formatApiErrorDetail(data.detail) || "Restore failed");
        return;
      }
      setMessage("Pack restored.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const tabMeta = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-4">
      {/* Top tabs: Day · Week · Month */}
      <div className="sticky top-0 z-20 -mx-1 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,var(--surface))] px-1 pb-0 pt-1 backdrop-blur-md">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const count =
              t.key === "day"
                ? dayTemplates.length
                : t.key === "week"
                  ? weekPacks.length
                  : monthPacks.length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabAndUrl(t.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--surface)] text-accent ring-1 ring-inset ring-accent/40"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-accent/20 text-accent" : "bg-[var(--surface-2)] text-[var(--muted)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">{tabMeta.blurb}</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input h-9 min-w-[12rem] flex-1 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Search ${tab} templates…`}
        />
        <button
          type="button"
          className="btn-ghost h-9 px-3 text-xs"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            className="accent-accent"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived shelf
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        {tab === "day" && (
          <div className="space-y-2">
            {filteredDays.length === 0 ? (
              <EmptyState
                title="No day templates yet"
                body="Open a program day, use Templates & paste → Save current workout as template. They show up here (newest first)."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {filteredDays.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text)]">{t.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-medium">
                          {t.category || "general"}
                        </span>
                        {t.versionLabel ? ` · ${t.versionLabel}` : ""}
                        {" · "}
                        {t.exerciseCount ?? "?"} exercises
                        {" · "}
                        {formatWhen(t.createdAt || t.updatedAt)}
                      </p>
                      {t.notes ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{t.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {t.workoutId ? (
                        <Link
                          href={`/admin/workouts/${t.workoutId}`}
                          className="btn-ghost px-2.5 py-1.5 text-[11px] font-semibold"
                        >
                          Open workout
                        </Link>
                      ) : null}
                      <Link
                        href="/admin/programs"
                        className="btn-ghost px-2.5 py-1.5 text-[11px] font-semibold"
                        title="Paste onto a program day from Templates & paste"
                      >
                        Paste in program
                      </Link>
                      <button
                        type="button"
                        className="btn-ghost px-2.5 py-1.5 text-[11px] text-amber-200"
                        disabled={busy}
                        onClick={() => void archiveDay(t.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "week" && (
          <CycleList
            packs={filteredWeeks}
            emptyTitle="No week packs yet"
            emptyBody="On a program calendar, use “Post current week to Template Library”. Week packs land here."
            busy={busy}
            onArchive={(id) => void archiveCycle(id)}
            kind="week"
          />
        )}

        {tab === "month" && (
          <CycleList
            packs={filteredMonths}
            emptyTitle="No month packs yet"
            emptyBody="Save a 28-day pack from Templates & paste on a program, or from Workouts cycle browser."
            busy={busy}
            onArchive={(id) => void archiveCycle(id)}
            kind="month"
          />
        )}
      </div>

      {showArchived ? (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-100">Archived shelf</p>
          {tab === "day" &&
            (archivedDays.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No archived day templates.</p>
            ) : (
              <ul className="space-y-2">
                {archivedDays.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">{t.name}</span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void restoreDay(t.id)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {tab === "week" &&
            (archivedWeek.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No archived week packs.</p>
            ) : (
              <ul className="space-y-2">
                {archivedWeek.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void restoreCycle(c.id)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {tab === "month" &&
            (archivedMonth.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No archived month packs.</p>
            ) : (
              <ul className="space-y-2">
                {archivedMonth.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-[11px]"
                      disabled={busy}
                      onClick={() => void restoreCycle(c.id)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      ) : null}

      <p className="text-[11px] text-[var(--muted)]">
        To apply templates: open a{" "}
        <Link href="/admin/programs" className="text-accent hover:underline">
          program
        </Link>
        , then use <strong className="text-[var(--text)]">Templates & paste</strong> (day) or{" "}
        <strong className="text-[var(--text)]">Week packs / 28-day pack</strong> on the calendar.
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-8 text-center">
      <p className="font-semibold text-[var(--text)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

function CycleList({
  packs,
  emptyTitle,
  emptyBody,
  busy,
  onArchive,
  kind,
}: {
  packs: CyclePack[];
  emptyTitle: string;
  emptyBody: string;
  busy: boolean;
  onArchive: (id: string) => void;
  kind: "week" | "month";
}) {
  if (packs.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {packs.map((c) => (
        <li
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--text)]">{c.name}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {kind === "week" ? "Week pack · Mon–Sun" : "28-day month pack"}
              {" · "}
              {filledDays(c)} days with content
              {" · "}
              {formatWhen(c.createdAt || c.updatedAt)}
            </p>
            {c.description ? (
              <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                {c.description.replace(/\s*\[week-pack\]\s*/gi, " ").trim()}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Link
              href="/admin/programs"
              className="btn-ghost px-2.5 py-1.5 text-[11px] font-semibold"
            >
              Paste in program
            </Link>
            <button
              type="button"
              className="btn-ghost px-2.5 py-1.5 text-[11px] text-amber-200"
              disabled={busy}
              onClick={() => onArchive(c.id)}
            >
              Archive
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
