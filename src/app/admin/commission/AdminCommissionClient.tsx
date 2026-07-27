"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminReferralCodesPanel from "@/app/admin/commission/AdminReferralCodesPanel";

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

type PaymentQueueItem = {
  id: string;
  payee: string;
  email: string | null;
  kind: "partner_pool" | "company_retain" | "platform_admin";
  kindLabel: string;
  amountCents: number;
  amountLabel: string;
  detail: string;
  status: "ready" | "blocked" | "info" | "paid" | "partial";
  statusLabel: string;
  action: "connect_pool" | "platform_admin" | "none";
  processable: boolean;
  blockedReason: string | null;
};

type CommissionResponse = {
  enabled: boolean;
  mode: "flat" | "tiered" | "milestone";
  periodSuggested: string;
  shareTotal: number;
  shareValid: boolean;
  shareMessage: string | null;
  companyFeed: {
    sharePercent: number;
    amountCents: number;
    amountLabel: string;
    label: string;
  } | null;
  mrr: { cents: number; label: string; activeSubscriptions: number };
  commission: {
    totalCommissionCents: number;
    totalLabel: string;
    tier1BaseCents: number;
    tier1CommissionCents: number;
    tier2BaseCents: number;
    tier2CommissionCents: number;
    tier1CapLabel: string;
    tier1CapCents?: number;
    tier1RatePercent: number;
    tier2RatePercent: number;
    atOrAboveGoal?: boolean;
    activeRatePercent?: number;
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
  payoutSchedule?: {
    mode: "on_demand" | "weekly";
    weekday: number;
    weekdayLabel: string;
  };
  /** Partner-pool floor before Connect transfers (default $400). */
  payoutMinimum?: {
    cents: number;
    label: string;
    met: boolean;
    shortfallCents: number;
    shortfallLabel: string;
  };
  stripeBalance?: {
    configured: boolean;
    testMode: boolean;
    availableCents: number | null;
    availableLabel: string | null;
    pendingCents: number | null;
    pendingLabel: string | null;
    error: string | null;
    publishableKeyPresent?: boolean;
  };
  paymentQueue?: PaymentQueueItem[];
  connectPlatform?: {
    ready: boolean;
    message: string | null;
  };
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
  const [adminFeeMsg, setAdminFeeMsg] = useState<string | null>(null);
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
      setError(body.error || "Could not load development & partnership fee data.");
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
    if (!confirm(`Remove ${partner.name} from development & partnership fee partners?`)) return;
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

  async function savePayoutSchedule(
    mode: "on_demand" | "weekly",
    weekday: number,
  ) {
    setBusy("payout-schedule");
    setError("");
    const res = await fetch("/api/admin/coach-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionPayoutMode: mode,
        commissionPayoutWeekday: weekday,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not save payout schedule.");
    } else {
      await load();
    }
    setBusy(null);
  }

  async function runPayout(dryRun: boolean) {
    setBusy(dryRun ? "dry" : "payout");
    setError("");
    setAdminFeeMsg(null);
    const res = await fetch("/api/stripe/commission/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: data?.periodSuggested, dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Payout failed.");
    } else {
      const lines = body.record?.partnerLines as
        | Array<{ partnerName: string; amountCents: number; status: string }>
        | undefined;
      const lineSummary = (lines || [])
        .map((l) => `${l.partnerName}: ${centsToUsd(l.amountCents)} (${l.status})`)
        .join(" · ");
      if (dryRun) {
        setAdminFeeMsg(
          `Preview pool ${body.record?.period || data?.periodSuggested}: ${lineSummary || body.message || "OK"}`,
        );
      } else {
        setAdminFeeMsg(
          `Processed partner pool ${body.record?.period || ""}: ${lineSummary || "done"}`,
        );
      }
      await load();
    }
    setBusy(null);
  }

  async function runPlatformAdminFee(dryRun: boolean) {
    setBusy(dryRun ? "admin-dry" : "admin-pay");
    setError("");
    setAdminFeeMsg(null);
    const res = await fetch("/api/stripe/commission/platform-admin-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Platform admin fee failed.");
      setBusy(null);
      return;
    }
    if (body.dryRun && body.preview) {
      setAdminFeeMsg(
        `Preview: ${body.preview.amountLabel} → ${body.preview.partnerName} (${body.preview.period}). Connect ${body.preview.connectReady ? "ready" : "not ready"}.`,
      );
    } else if (body.transferId) {
      setAdminFeeMsg(
        `Paid ${body.preview?.amountLabel ?? "platform admin"} to ${body.preview?.partnerName ?? "partner"} · ${body.transferId}`,
      );
      await load();
    } else {
      setAdminFeeMsg("Platform admin fee updated.");
      await load();
    }
    setBusy(null);
  }

  const goalProgressPct =
    data && data.commission.tier1CapCents && data.commission.tier1CapCents > 0
      ? Math.min(100, (data.mrr.cents / data.commission.tier1CapCents) * 100)
      : 0;
  const tier1Pct =
    data && data.mrr.cents > 0 && data.mode === "tiered"
      ? Math.min(100, (data.commission.tier1BaseCents / data.mrr.cents) * 100)
      : 0;

  const highlightedPartner =
    connectPartnerId && data?.partners.find((p) => p.id === connectPartnerId);

  const queue = data?.paymentQueue ?? [];
  const balance = data?.stripeBalance;
  const poolProcessable = queue.some((q) => q.action === "connect_pool" && q.processable);
  const adminProcessable = queue.some((q) => q.action === "platform_admin" && q.processable);

  function statusTone(status: PaymentQueueItem["status"]): string {
    if (status === "ready") return "bg-emerald-500/15 text-emerald-300";
    if (status === "paid") return "bg-sky-500/15 text-sky-200";
    if (status === "partial") return "bg-violet-500/15 text-violet-200";
    if (status === "info") return "bg-[var(--surface-2)] text-[var(--muted)]";
    return "bg-amber-500/15 text-amber-200";
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Money desk</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Stripe balance, holding minimum, and a payout queue for John (business partner) and
            Jeremy (company feed on master Stripe). Membership card money stays on this platform;
            John’s Eco Delight coffee partnership pays via Eco Stripe Connect (
            <code className="text-[10px]">john@thetrainstation.co</code> · JOHNPARTNER). Process
            partner pool and platform admin fee here when TS Connect is Ready.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={loading || busy !== null}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "Refresh balance"}
        </button>
      </div>

      {connectNotice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {highlightedPartner
            ? `Stripe Connect update for ${highlightedPartner.name} — check status below.`
            : "Stripe Connect onboarding update — check partner status below."}
        </p>
      )}

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {data?.connectPlatform && !data.connectPlatform.ready && data.connectPlatform.message && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong className="text-amber-100">Stripe Connect setup needed.</strong>{" "}
          {data.connectPlatform.message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : data ? (
        <>
          {/* KPI strip: balance + holding min + pool */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Stripe available
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {balance?.availableLabel ?? "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {balance?.error
                  ? balance.error
                  : balance?.testMode
                    ? "Test mode balance"
                    : "Live master account (Jeremy)"}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Stripe pending
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {balance?.pendingLabel ?? "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Settling · not yet available
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Holding minimum
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {data.payoutMinimum?.label ?? "$400"}
              </div>
              <div
                className={`mt-1 text-xs ${
                  data.payoutMinimum?.met ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {data.payoutMinimum?.met
                  ? "Pool meets floor — Connect payouts unlocked"
                  : `Short ${data.payoutMinimum?.shortfallLabel ?? "—"} for Connect transfers`}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
                Partner pool · {data.periodSuggested}
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {data.commission.totalLabel}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                MRR {data.mrr.label} · {data.mrr.activeSubscriptions} active sub
                {data.mrr.activeSubscriptions === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* Payment queue */}
          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
                  Payment queue
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Queued amounts for John (Connect) and Jeremy (company feed). Preview first, then
                  process when Connect is Ready and the holding minimum is met.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  disabled={busy !== null}
                  onClick={() => void runPayout(true)}
                >
                  {busy === "dry" ? "…" : "Preview pool"}
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy !== null || !poolProcessable}
                  title={
                    !poolProcessable
                      ? "Fix Connect / shares / holding minimum before processing"
                      : undefined
                  }
                  onClick={() => {
                    if (
                      !confirm(
                        `Transfer partner pool for ${data.periodSuggested} via Connect? Uses master Stripe balance.`,
                      )
                    ) {
                      return;
                    }
                    void runPayout(false);
                  }}
                >
                  {busy === "payout" ? "Transferring…" : "Process partner pool"}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busy !== null || !adminProcessable}
                  onClick={() => {
                    if (
                      !confirm(
                        "Transfer platform admin fee ($275 default) to John via Connect?",
                      )
                    ) {
                      return;
                    }
                    void runPlatformAdminFee(false);
                  }}
                >
                  {busy === "admin-pay" ? "Paying…" : "Process platform admin"}
                </button>
              </div>
            </div>

            {queue.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No queued lines yet — add partners and ensure MRR/pool math has amounts.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                      <th className="px-3 py-2">Payee</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border)] last:border-0 align-top"
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.payee}</div>
                          {row.email ? (
                            <div className="text-xs text-[var(--muted)]">{row.email}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted)]">{row.kindLabel}</td>
                        <td className="px-3 py-3 font-semibold">{row.amountLabel}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(row.status)}`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted)]">
                          <div>{row.detail}</div>
                          {row.blockedReason ? (
                            <div className="mt-1 text-amber-300">{row.blockedReason}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminFeeMsg && (
              <p className="text-sm text-violet-100/90 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                {adminFeeMsg}
              </p>
            )}
          </div>

          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
                Active partners
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  data.shareValid
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                Shares: {data.shareTotal}%
                {data.mode === "flat"
                  ? !data.shareValid
                    ? " — max 100% of revenue"
                    : ` — company keeps ${Math.max(0, 100 - data.shareTotal)}%`
                  : !data.shareValid
                    ? " — must equal 100% of pool"
                    : " — of fee pool"}
              </span>
            </div>

            {data.partners.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No partners yet. Use the form below to add someone who receives a share of the
                development &amp; partnership fee pool.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                      <th className="px-3 py-2">Partner</th>
                      <th className="px-3 py-2">Share</th>
                      <th className="px-3 py-2">Stripe</th>
                      <th className="px-3 py-2">Est. payout</th>
                      <th className="px-3 py-2" />
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
                          <td className="px-3 py-3">
                            <div className="font-medium">{partner.name}</div>
                            <div className="text-xs text-[var(--muted)]">{partner.email}</div>
                            {!partner.enabled && (
                              <span className="text-[10px] text-amber-400">Disabled</span>
                            )}
                          </td>
                          <td className="px-3 py-3">{partner.sharePercent}%</td>
                          <td className="px-3 py-3 text-xs">
                            {!connect?.configured ? (
                              <span className="text-amber-300">Not linked</span>
                            ) : ready ? (
                              <span className="text-emerald-300">Ready</span>
                            ) : (
                              <span className="text-amber-300">Onboarding</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">
                            {partner.enabled && split ? split.amountLabel : "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
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
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
                Add partner
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Future shareholders or co-owners — each completes their own Stripe Connect onboarding.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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

          {/* Platform admin fee — $275/mo Grok + infra; separate from MRR pool */}
          <div className="card space-y-3 p-5 border border-violet-500/25">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[2px] text-violet-300">
                  Platform admin fee
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Agreed <strong className="text-[var(--text)]">$275/mo</strong> → John (Grok $200 +
                  infra). <em>Not</em> the 5%/30% membership fee pool. Requires John’s Connect
                  Express Ready, then transfer from Jeremy’s master Stripe.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={busy !== null}
                onClick={() => void runPlatformAdminFee(true)}
              >
                {busy === "admin-dry" ? "Previewing…" : "Preview $275"}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy !== null}
                onClick={() => {
                  if (
                    !confirm(
                      "Transfer platform admin fee ($275 default) to John via Connect? This uses live/test Stripe balance on the master account.",
                    )
                  ) {
                    return;
                  }
                  void runPlatformAdminFee(false);
                }}
              >
                {busy === "admin-pay" ? "Paying…" : "Pay platform admin now"}
              </button>
            </div>
            {adminFeeMsg && (
              <p className="text-sm text-violet-100/90 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                {adminFeeMsg}
              </p>
            )}
            <p className="text-[11px] text-[var(--muted)]">
              Env: <code className="text-[10px]">STRIPE_PLATFORM_ADMIN_FEE_DOLLARS</code> (default
              275) · partner email match{" "}
              <code className="text-[10px]">STRIPE_PLATFORM_ADMIN_PARTNER_EMAIL</code>
            </p>
          </div>

          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              {data.mode === "flat" ? "MRR & revenue feeds" : "MRR & partner pool"}
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
                  {data.mode === "flat" ? "Partner payouts (Connect)" : "Partner pool this month"}
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {data.commission.totalLabel}
                </div>
              </div>
            </div>
            {data.payoutMinimum ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  data.payoutMinimum.met
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                }`}
              >
                <p className="font-semibold">
                  Payout minimum: {data.payoutMinimum.label}
                </p>
                <p className="mt-1 text-xs opacity-90">
                  {data.payoutMinimum.met
                    ? "Partner pool is at or above the floor — Run payout can transfer via Connect."
                    : `Need ${data.payoutMinimum.shortfallLabel} more in the partner pool before Connect transfers (covers platform / admin fees). Preview still works.`}
                </p>
              </div>
            ) : null}
            {data.companyFeed ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {data.projectedSplits.map((split) => (
                  <div
                    key={split.partnerId}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                  >
                    <div className="text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                      {split.partnerName}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{split.amountLabel}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {data.mode === "flat"
                        ? `${split.sharePercent}% of MRR`
                        : `${split.sharePercent}% of pool`}
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                  <div className="text-[10px] uppercase tracking-[2px] text-sky-200/80">
                    {data.companyFeed.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-sky-100">
                    {data.companyFeed.amountLabel}
                  </div>
                  <div className="text-xs text-sky-200/70">
                    {data.companyFeed.sharePercent}% retained on platform
                  </div>
                </div>
              </div>
            ) : null}
            {data.mode === "milestone" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>
                    Goal: {data.commission.tier1CapLabel} MRR —{" "}
                    {data.commission.atOrAboveGoal ? (
                      <span className="text-emerald-300">
                        unlocked {data.commission.tier2RatePercent}% rate
                      </span>
                    ) : (
                      <span>
                        {data.commission.tier1RatePercent}% rate until goal (
                        {Math.round(goalProgressPct)}% there)
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-white">
                    Active rate: {data.commission.activeRatePercent ?? data.commission.tier1RatePercent}%
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={
                      data.commission.atOrAboveGoal
                        ? "bg-violet-500/70"
                        : "bg-emerald-500/70"
                    }
                    style={{ width: `${goalProgressPct}%` }}
                  />
                </div>
              </div>
            )}
            {data.mode === "tiered" && (
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="bg-emerald-500/70" style={{ width: `${tier1Pct}%` }} />
                <div className="bg-violet-500/70" style={{ width: `${100 - tier1Pct}%` }} />
              </div>
            )}
            {data.shareMessage && !data.shareValid && (
              <p className="text-sm text-amber-400">{data.shareMessage}</p>
            )}
          </div>

          <AdminReferralCodesPanel />

          <div className="card space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
              Partner payout schedule
            </h2>
            <p className="text-sm text-[var(--muted)]">
              How John and Jeremy get their Connect transfers. Member Stripe checkout is separate —
              this only controls when partner shares move out of the platform account.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="payout-mode"
                  className="mt-0.5"
                  checked={(data.payoutSchedule?.mode ?? "on_demand") === "on_demand"}
                  disabled={busy !== null}
                  onChange={() =>
                    void savePayoutSchedule(
                      "on_demand",
                      data.payoutSchedule?.weekday ?? 5,
                    )
                  }
                />
                <span>
                  <span className="font-medium">Pay on demand</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    No automatic day — you tap Run payout now when you&apos;re ready (recommended
                    for Jeremy).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="payout-mode"
                  className="mt-0.5"
                  checked={data.payoutSchedule?.mode === "weekly"}
                  disabled={busy !== null}
                  onChange={() =>
                    void savePayoutSchedule(
                      "weekly",
                      data.payoutSchedule?.weekday ?? 5,
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">Weekly (automated cron)</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Optional cron job runs only on the weekday you pick below.
                  </span>
                  {data.payoutSchedule?.mode === "weekly" && (
                    <select
                      className="input mt-2 w-full max-w-xs text-sm"
                      value={data.payoutSchedule.weekday}
                      disabled={busy !== null}
                      onChange={(e) =>
                        void savePayoutSchedule("weekly", Number(e.target.value))
                      }
                    >
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  )}
                </span>
              </label>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Manual transfer for period{" "}
              <strong className="text-white">{data.periodSuggested}</strong>.
              {data.mode === "flat"
                ? " Company share stays on the platform account — no transfer needed."
                : " Enabled partner shares must total 100% of the partner pool."}
              {data.payoutMinimum
                ? ` Minimum pool before transfer: ${data.payoutMinimum.label}.`
                : ""}
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
                disabled={
                  busy !== null ||
                  !data.shareValid ||
                  data.payoutMinimum?.met === false
                }
                title={
                  data.payoutMinimum?.met === false
                    ? `Need ${data.payoutMinimum.shortfallLabel} more before payout`
                    : undefined
                }
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