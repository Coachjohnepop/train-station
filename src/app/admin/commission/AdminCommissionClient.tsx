"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ConnectStatus = {
  partnerId: string;
  configured: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

type Partner = {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  sharePercent: number;
  enabled: boolean;
  notes: string | null;
  connect: ConnectStatus | null;
};

type CommissionResponse = {
  enabled: boolean;
  periodSuggested: string;
  shareTotal: number;
  shareValid: boolean;
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
  partners: Partner[];
  projectedSplits: Array<{
    partnerId: string;
    partnerName: string;
    sharePercent: number;
    amountCents: number;
    amountLabel: string;
  }>;
  payouts: Array<{
    period: string;
    totalCommissionCents: number;
    mrrCents: number;
    status: string;
    paidAt: string | null;
    error: string | null;
    partnerLines?: Array<{
      partnerId: string;
      partnerName: string;
      sharePercent: number;
      amountCents: number;
      status: string;
      transferId: string | null;
      error: string | null;
    }>;
  }>;
};

function centsToUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

const emptyPartnerForm = { name: "", email: "", sharePercent: "0", notes: "" };

export default function AdminCommissionClient() {
  const searchParams = useSearchParams();
  const connectNotice = searchParams.get("connect");
  const connectPartnerId = searchParams.get("partnerId");
  const [data, setData] = useState<CommissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(emptyPartnerForm);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    sharePercent: "0",
    enabled: true,
    notes: "",
  });

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

  async function addPartner() {
    setBusy("add");
    setError("");
    const res = await fetch("/api/admin/commission/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        sharePercent: Number(addForm.sharePercent) || 0,
        notes: addForm.notes.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not add partner.");
    } else {
      setAddForm(emptyPartnerForm);
      await load();
    }
    setBusy(null);
  }

  function openEdit(partner: Partner) {
    setEditPartner(partner);
    setEditForm({
      name: partner.name,
      email: partner.email,
      sharePercent: String(partner.sharePercent),
      enabled: partner.enabled,
      notes: partner.notes || "",
    });
  }

  async function saveEdit() {
    if (!editPartner) return;
    setBusy(`edit-${editPartner.id}`);
    setError("");
    const res = await fetch(
      `/api/admin/commission/partners/${encodeURIComponent(editPartner.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          sharePercent: Number(editForm.sharePercent) || 0,
          enabled: editForm.enabled,
          notes: editForm.notes.trim() || null,
        }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not save partner.");
    } else {
      setEditPartner(null);
      await load();
    }
    setBusy(null);
  }

  async function removePartner(partner: Partner) {
    if (!confirm(`Remove ${partner.name} from commission partners?`)) return;
    setBusy(`del-${partner.id}`);
    setError("");
    const res = await fetch(
      `/api/admin/commission/partners/${encodeURIComponent(partner.id)}`,
      { method: "DELETE" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not remove partner.");
    } else {
      await load();
    }
    setBusy(null);
  }

  async function startConnect(partnerId: string) {
    setBusy(`connect-${partnerId}`);
    setError("");
    const res = await fetch("/api/stripe/connect/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error || "Connect onboarding failed.");
    setBusy(null);
  }

  async function openDashboard(partnerId: string) {
    setBusy(`dash-${partnerId}`);
    setError("");
    const res = await fetch("/api/stripe/connect/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId }),
    });
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
      body: JSON.stringify({ period: data?.periodSuggested, dryRun }),
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

  const highlightedPartner =
    connectPartnerId && data?.partners.find((p) => p.id === connectPartnerId);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commission admin</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Manage payout partners, share splits, and monthly Stripe Connect transfers. Tiered pool:{" "}
          {data?.commission.tier1RatePercent ?? 5}% on first{" "}
          {data?.commission.tier1CapLabel ?? "$5,000"} MRR, then{" "}
          {data?.commission.tier2RatePercent ?? 30}% above.
        </p>
      </div>

      {connectNotice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {highlightedPartner
            ? `Stripe Connect update for ${highlightedPartner.name} — check status below.`
            : "Stripe Connect onboarding update — check partner status below."}
        </p>
      )}

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : data ? (
        <>
          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
                Payout partners
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  data.shareValid
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                Shares: {data.shareTotal}%
                {!data.shareValid ? " — must equal 100%" : ""}
              </span>
            </div>

            {data.partners.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No partners yet. Add John (or anyone else) who receives a share of the commission
                pool.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                      <th className="px-2 py-2">Partner</th>
                      <th className="px-2 py-2">Share</th>
                      <th className="px-2 py-2">Stripe</th>
                      <th className="px-2 py-2">Est. payout</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.partners.map((partner) => {
                      const split = data.projectedSplits.find(
                        (s) => s.partnerId === partner.id,
                      );
                      const connect = partner.connect;
                      const ready = connect?.payoutsEnabled && connect?.detailsSubmitted;
                      return (
                        <tr
                          key={partner.id}
                          className={`border-b border-[var(--border)] last:border-0 ${
                            !partner.enabled ? "opacity-50" : ""
                          }`}
                        >
                          <td className="px-2 py-3">
                            <div className="font-medium">{partner.name}</div>
                            <div className="text-xs text-[var(--muted)]">{partner.email}</div>
                            {!partner.enabled && (
                              <span className="text-[10px] text-amber-400">Disabled</span>
                            )}
                          </td>
                          <td className="px-2 py-3">{partner.sharePercent}%</td>
                          <td className="px-2 py-3 text-xs">
                            {!connect?.configured ? (
                              <span className="text-amber-300">Not linked</span>
                            ) : ready ? (
                              <span className="text-emerald-300">Ready</span>
                            ) : (
                              <span className="text-amber-300">Onboarding</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-[var(--muted)]">
                            {partner.enabled && split ? split.amountLabel : "—"}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                className="btn-ghost text-[10px] px-2 py-1"
                                onClick={() => openEdit(partner)}
                              >
                                Edit
                              </button>
                              {!ready && (
                                <button
                                  type="button"
                                  className="btn-primary text-[10px] px-2 py-1"
                                  disabled={busy !== null}
                                  onClick={() => void startConnect(partner.id)}
                                >
                                  Connect
                                </button>
                              )}
                              {connect?.configured && (
                                <button
                                  type="button"
                                  className="btn-ghost text-[10px] px-2 py-1"
                                  disabled={busy !== null}
                                  onClick={() => void openDashboard(partner.id)}
                                >
                                  Stripe
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Share %"
                type="number"
                min={0}
                max={100}
                value={addForm.sharePercent}
                onChange={(e) => setAddForm((f) => ({ ...f, sharePercent: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Notes (optional)"
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={
                busy !== null || !addForm.name.trim() || !addForm.email.trim()
              }
              onClick={() => void addPartner()}
            >
              {busy === "add" ? "Adding…" : "Add partner"}
            </button>
          </div>

          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              MRR & commission pool
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
                  Total commission pool
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {data.commission.totalLabel}
                </div>
              </div>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className="bg-emerald-500/70" style={{ width: `${tier1Pct}%` }} />
              <div className="bg-violet-500/70" style={{ width: `${100 - tier1Pct}%` }} />
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              Monthly payout
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Transfers each enabled partner their share for period{" "}
              <strong className="text-white">{data.periodSuggested}</strong>. All enabled shares
              must total 100%; each partner needs Connect onboarding complete.
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
                disabled={busy !== null || !data.shareValid}
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
                    <th className="px-4 py-3">Pool</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Partners</th>
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
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">
                        {(p.partnerLines || []).map((line) => (
                          <div key={`${p.period}-${line.partnerId}`}>
                            {line.partnerName}: {centsToUsd(line.amountCents)} ({line.status})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {editPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold">Edit partner</h2>
            <div className="space-y-3">
              <input
                className="input w-full"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input w-full"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                className="input w-full"
                type="number"
                min={0}
                max={100}
                value={editForm.sharePercent}
                onChange={(e) => setEditForm((f) => ({ ...f, sharePercent: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                Enabled for payouts
              </label>
              <textarea
                className="input min-h-[72px] w-full"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                className="text-xs text-rose-400 hover:underline"
                onClick={() => void removePartner(editPartner)}
              >
                Remove partner
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-sm" onClick={() => setEditPartner(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy === `edit-${editPartner.id}`}
                  onClick={() => void saveEdit()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}