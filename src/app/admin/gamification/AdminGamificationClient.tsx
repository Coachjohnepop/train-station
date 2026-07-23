"use client";

import { useCallback, useEffect, useState } from "react";
import type { GamificationLevers } from "@/lib/gamification-levers";
import { DEFAULT_GAMIFICATION_LEVERS } from "@/lib/gamification-levers";

type Promo = {
  id: string;
  userId: string;
  fromPlan: string;
  toPlan: string;
  status: string;
  offeredAt: string;
  claimBy: string | null;
  trialEndsAt: string | null;
};

type Tab = "levers" | "promos" | "overview" | "audit";

type AuditEntry = {
  id: string;
  at: string;
  actorId: string;
  actorRole: string | null;
  action: string;
  targetId: string | null;
  detail: unknown;
  ip: string | null;
};

export default function AdminGamificationClient() {
  const [tab, setTab] = useState<Tab>("levers");
  const [levers, setLevers] = useState<GamificationLevers>({ ...DEFAULT_GAMIFICATION_LEVERS });
  const [database, setDatabase] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantFrom, setGrantFrom] = useState("explorer");
  const [grantTo, setGrantTo] = useState("member");

  const loadConfig = useCallback(async () => {
    const res = await fetch("/api/admin/gamification/config", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.levers) setLevers(data.levers);
    setDatabase(Boolean(data.database));
  }, []);

  const loadPromos = useCallback(async () => {
    const res = await fetch("/api/admin/gamification/promos", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPromos(data.promos || []);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetch("/api/admin/gamification/audit?limit=80", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAudit(data.entries || []);
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadPromos();
  }, [loadConfig, loadPromos]);

  useEffect(() => {
    if (tab === "audit") void loadAudit();
  }, [tab, loadAudit]);

  async function saveLevers() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gamification/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(levers),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Save failed");
      setLevers(data.levers);
      setMessage("Levers saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function recompute() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gamification/recompute", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Recompute failed");
      setMessage(
        `Recomputed seasons · expired ${data.expired ?? 0} promos · offered ${data.offered ?? 0} free weeks.`,
      );
      await loadPromos();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Recompute failed");
    } finally {
      setBusy(false);
    }
  }

  async function grantPromo() {
    if (!grantUserId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gamification/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: grantUserId.trim(),
          fromPlan: grantFrom,
          toPlan: grantTo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Grant failed");
      setMessage("Promo offered.");
      setGrantUserId("");
      await loadPromos();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this promo?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/gamification/promos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Revoke failed");
      await loadPromos();
      setMessage("Promo revoked.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  function setNum<K extends keyof GamificationLevers>(key: K, value: number) {
    setLevers((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Arcade economy</p>
        <h1 className="text-2xl font-bold">Gamification</h1>
        <p className="text-sm text-[var(--muted)]">
          Division scoreboards, top-{levers.topPercentile}% free-week hooks, and content-access levers.
          Storage: {database ? "Postgres" : "demo / no DB (levers in memory only)"}.
        </p>
      </header>

      {message ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["levers", "Levers"],
            ["promos", "Promos"],
            ["overview", "Actions"],
            ["audit", "Audit log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              tab === id
                ? "border-accent bg-accent/20 text-accent"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Season actions</h2>
          <p className="text-sm text-[var(--muted)]">
            Recompute ranks for Free / Coach / Business / 1st Class, expire stale promos, and offer
            free weeks to top {levers.topPercentile}% (min activity rules apply).
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !database}
            onClick={() => void recompute()}
          >
            Recompute + offer free weeks
          </button>
          {!database ? (
            <p className="text-xs text-[var(--danger)]">
              Apply migration <code>20260722180000_gamification_v2</code> on prod Postgres first.
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === "levers" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Levers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["freeContentPercent", "Free content %", 0, 100],
                ["coachContentPercent", "Coach content %", 0, 100],
                ["topPercentile", "Top % cut", 1, 100],
                ["freeWeekDays", "Free week days", 1, 30],
                ["claimWindowHours", "Claim window (hours)", 1, 720],
                ["seasonDays", "Season window (days)", 7, 90],
                ["minActiveDaysForPercentile", "Min active days", 0, 28],
                ["minSeasonPointsForPercentile", "Min season points", 0, 10000],
                ["minDivisionSizeForTopCut", "Min division size", 1, 100],
                ["dailyPointCap", "Daily point cap (0=off)", 0, 10000],
                ["cooldownDaysPerEdge", "Promo cooldown (days)", 0, 365],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key} className="block text-sm">
                <span className="text-[var(--muted)]">{label}</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  min={min}
                  max={max}
                  value={levers[key] as number}
                  onChange={(e) => setNum(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["featureEnabled", "Feature enabled"],
                ["crossDivisionPeek", "Coach top % peeks upstairs"],
                ["prizeBandEnabled", "Prize band"],
                ["anonymizeRivals", "Anonymize rivals"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(levers[key])}
                  onChange={(e) => setLevers((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveLevers()}>
            Save levers
          </button>
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <p className="text-sm text-[var(--muted)]">
            Append-only trail for config changes, promo offers/claims/revokes, and season recomputes.
            Suitable for M&amp;A / compliance review — no secrets stored.
          </p>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void loadAudit()}>
            Refresh
          </button>
          <ul className="divide-y divide-[var(--border)] text-xs">
            {audit.length === 0 ? (
              <li className="py-3 text-[var(--muted)]">No audit rows yet (needs Postgres + actions).</li>
            ) : (
              audit.map((e) => (
                <li key={e.id} className="space-y-1 py-3">
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {new Date(e.at).toISOString()} · {e.action}
                  </p>
                  <p>
                    <span className="font-semibold">{e.actorId}</span>
                    {e.actorRole ? ` (${e.actorRole})` : ""}
                    {e.targetId ? ` · target ${e.targetId}` : ""}
                    {e.ip ? ` · ${e.ip}` : ""}
                  </p>
                  {e.detail ? (
                    <pre className="max-h-24 overflow-auto rounded bg-[var(--surface-2)] p-2 text-[10px]">
                      {JSON.stringify(e.detail, null, 0)}
                    </pre>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "promos" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Free-week promos</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              className="input sm:col-span-2"
              placeholder="userId (member-…)"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
            />
            <select className="input" value={grantFrom} onChange={(e) => setGrantFrom(e.target.value)}>
              <option value="explorer">from Free</option>
              <option value="member">from Coach</option>
              <option value="business">from Business</option>
            </select>
            <select className="input" value={grantTo} onChange={(e) => setGrantTo(e.target.value)}>
              <option value="member">to Coach</option>
              <option value="business">to Business</option>
              <option value="pro">to 1st Class</option>
            </select>
          </div>
          <button type="button" className="btn-primary" disabled={busy || !database} onClick={() => void grantPromo()}>
            Offer free week
          </button>

          <ul className="divide-y divide-[var(--border)] text-sm">
            {promos.length === 0 ? (
              <li className="py-3 text-[var(--muted)]">No open promos.</li>
            ) : (
              promos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">
                      {p.userId} · {p.fromPlan} → {p.toPlan}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.status}
                      {p.claimBy ? ` · claim by ${new Date(p.claimBy).toLocaleString()}` : ""}
                      {p.trialEndsAt ? ` · trial ends ${new Date(p.trialEndsAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {(p.status === "offered" || p.status === "claimed") && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--danger)]"
                      onClick={() => void revoke(p.id)}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
