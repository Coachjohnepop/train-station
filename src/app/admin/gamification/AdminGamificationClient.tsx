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

type Tab = "levers" | "promos" | "overview" | "audit" | "free-pool" | "prizes";

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

type FreePoolDay = {
  dayId: string;
  weekNumber: number;
  dayNumber: number;
  enrollmentDayNumber: number;
  freePool: boolean;
  contentTierMin: string | null;
  label: string;
  hasWorkout: boolean;
};

type Prize = {
  id: string;
  userId: string;
  label: string;
  freeDays: number | null;
  seasonKey: string;
  awardedAt: string;
};

export default function AdminGamificationClient() {
  const [tab, setTab] = useState<Tab>("levers");
  const [levers, setLevers] = useState<GamificationLevers>({ ...DEFAULT_GAMIFICATION_LEVERS });
  const [database, setDatabase] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [freeDays, setFreeDays] = useState<FreePoolDay[]>([]);
  const [curatedCount, setCuratedCount] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantFrom, setGrantFrom] = useState("explorer");
  const [grantTo, setGrantTo] = useState("member");
  const [prizeUserId, setPrizeUserId] = useState("");
  const [prizeLabel, setPrizeLabel] = useState("Season champion");
  const [prizeDays, setPrizeDays] = useState(7);

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

  const loadFreePool = useCallback(async () => {
    const res = await fetch("/api/admin/gamification/free-pool?program=adult", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFreeDays(data.days || []);
      setCuratedCount(data.curatedCount || 0);
    }
  }, []);

  const loadPrizes = useCallback(async () => {
    const res = await fetch("/api/admin/gamification/prizes", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPrizes(data.prizes || []);
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadPromos();
  }, [loadConfig, loadPromos]);

  useEffect(() => {
    if (tab === "audit") void loadAudit();
    if (tab === "free-pool") void loadFreePool();
    if (tab === "prizes") void loadPrizes();
  }, [tab, loadAudit, loadFreePool, loadPrizes]);

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
      const imp = data.imported;
      setMessage(
        `Recomputed seasons · expired ${data.expired ?? 0} promos · offered ${data.offered ?? 0} free weeks` +
          (imp
            ? ` · imported ${imp.imported ?? 0} events from ${imp.users ?? 0} blob users (${imp.skipped ?? 0} skipped)`
            : "") +
          ".",
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

  async function toggleFreePool(day: FreePoolDay) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gamification/free-pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayId: day.dayId, freePool: !day.freePool }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatDetail(data.detail) || "Update failed");
      await loadFreePool();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedFreeTenPercent() {
    setBusy(true);
    setMessage(null);
    try {
      const target = Math.max(1, Math.ceil((28 * (levers.freeContentPercent || 10)) / 100));
      let flipped = 0;
      for (const day of freeDays) {
        const want = day.enrollmentDayNumber <= target;
        if (day.freePool !== want) {
          const res = await fetch("/api/admin/gamification/free-pool", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dayId: day.dayId, freePool: want }),
          });
          if (res.ok) flipped += 1;
        }
      }
      await loadFreePool();
      setMessage(`Pinned free sample days 1–${target} (${flipped} updates).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function awardPrize() {
    if (!prizeUserId.trim() || !prizeLabel.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gamification/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: prizeUserId.trim(),
          label: prizeLabel.trim(),
          freeDays: prizeDays || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatDetail(data.detail) || "Award failed");
      setMessage("Prize awarded — shows on member Hall of Fame.");
      setPrizeUserId("");
      await loadPrizes();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Award failed");
    } finally {
      setBusy(false);
    }
  }

  function formatDetail(detail: unknown): string {
    if (typeof detail === "string") return detail;
    return "";
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
            ["free-pool", "Free pool"],
            ["promos", "Promos"],
            ["prizes", "Prizes"],
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
                [
                  "freeRequiresPaymentMethod",
                  "Free Explorer requires card on file ($0 — no charge until upgrade)",
                ],
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
          <p className="text-xs text-[var(--muted)]">
            Card-on-file uses Stripe Setup (card only, not ACH). Default is off. When on, new Free
            signups go to Payment setup before onboard; training stays locked until a card is saved.
          </p>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveLevers()}>
            Save levers
          </button>
        </section>
      ) : null}

      {tab === "free-pool" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Free sample days (Adult)</h2>
          <p className="text-sm text-[var(--muted)]">
            Pin which program days Free Explorers can open. Once any day is pinned,{" "}
            <strong>curated mode</strong> is on (percent fallback is off).{" "}
            {curatedCount > 0
              ? `${curatedCount} day(s) pinned.`
              : "No pins yet — free access uses percent-of-cycle (days 1–3 by default)."}
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !database || freeDays.length === 0}
            onClick={() => void seedFreeTenPercent()}
          >
            Seed ~{levers.freeContentPercent}% free days
          </button>
          <ul className="max-h-96 space-y-1 overflow-y-auto text-sm">
            {freeDays.length === 0 ? (
              <li className="text-[var(--muted)]">No Adult program days found.</li>
            ) : (
              freeDays.map((d) => (
                <li
                  key={d.dayId}
                  className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-2 py-1.5"
                >
                  <span>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      D{d.enrollmentDayNumber}
                    </span>{" "}
                    {d.label}
                    {!d.hasWorkout ? (
                      <span className="ml-1 text-[10px] text-amber-400">no workout</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      d.freePool
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                    onClick={() => void toggleFreePool(d)}
                  >
                    {d.freePool ? "Free sample" : "Locked for free"}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "prizes" ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Prize theater</h2>
          <p className="text-sm text-[var(--muted)]">
            Award season trophies / free membership days. Shows on member High scores Hall of Fame.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input sm:col-span-1"
              placeholder="userId"
              value={prizeUserId}
              onChange={(e) => setPrizeUserId(e.target.value)}
            />
            <input
              className="input sm:col-span-1"
              placeholder="Label"
              value={prizeLabel}
              onChange={(e) => setPrizeLabel(e.target.value)}
            />
            <input
              className="input"
              type="number"
              min={0}
              max={90}
              value={prizeDays}
              onChange={(e) => setPrizeDays(Number(e.target.value) || 0)}
              title="Free days"
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !database}
            onClick={() => void awardPrize()}
          >
            Award prize
          </button>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {prizes.length === 0 ? (
              <li className="py-2 text-[var(--muted)]">No prizes yet.</li>
            ) : (
              prizes.map((p) => (
                <li key={p.id} className="py-2">
                  <span className="font-semibold text-amber-200">{p.label}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {p.userId.slice(0, 18)}
                    {p.freeDays ? ` · ${p.freeDays} free days` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
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
