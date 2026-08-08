"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Step = {
  id: string;
  label: string;
  done: boolean;
  at: string | null;
  detail: string | null;
};

type MemberRow = {
  userId: string;
  email: string;
  name: string;
  planLabel: string;
  phone: string | null;
  steps: Step[];
  progressPercent: number;
  openCount: number;
  nextAction: string | null;
  deepLink: string;
};

export default function CoachNeedsDonePanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/needs-done?openOnly=1&limit=30", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load checklist.");
        setMembers([]);
        return;
      }
      setMembers(data.members || []);
    } catch {
      setError("Could not load checklist.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`rounded-xl border border-amber-500/30 bg-amber-500/5 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-amber-100">
            Needs done
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Shared checklist so we don&apos;t lose members in the funnel — signup → gear → start →
            intro → first workout.
          </p>
        </div>
        <button type="button" className="btn-ghost text-[10px]" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--muted)]">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-xs text-red-300">{error}</p>
      ) : members.length === 0 ? (
        <p className="mt-3 text-xs text-emerald-300/90">
          No open funnel items — all tracked members are clear.
        </p>
      ) : (
        <ul className={`mt-3 space-y-2 ${compact ? "max-h-64 overflow-y-auto" : ""}`}>
          {members.map((m) => {
            const open = expanded === m.userId;
            return (
              <li
                key={m.userId}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpanded(open ? null : m.userId)}
                  >
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="truncate text-[10px] text-[var(--muted)]">
                      {m.planLabel} · {m.email}
                      {m.nextAction ? ` · next: ${m.nextAction}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                      {m.openCount} open · {m.progressPercent}%
                    </span>
                    <Link
                      href={m.deepLink}
                      className="text-[10px] font-semibold text-accent hover:underline"
                    >
                      Message
                    </Link>
                    <Link
                      href={`/admin/members`}
                      className="text-[10px] font-semibold text-[var(--muted)] hover:text-accent"
                    >
                      Members
                    </Link>
                  </div>
                </div>
                {open ? (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {m.steps.map((s) => (
                      <li
                        key={s.id}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 text-[11px] ${
                          s.done
                            ? "bg-emerald-500/10 text-[var(--success)]/90"
                            : "bg-amber-500/10 text-amber-50"
                        }`}
                      >
                        <span aria-hidden>{s.done ? "✓" : "○"}</span>
                        <span>
                          <span className="font-medium">{s.label}</span>
                          {s.detail ? (
                            <span className="block text-[10px] opacity-80">{s.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
