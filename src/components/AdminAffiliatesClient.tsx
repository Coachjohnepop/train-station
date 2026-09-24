"use client";

import { useCallback, useEffect, useState } from "react";

type AffiliateRow = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  commissionMonths: number | null;
  vanityPath: string | null;
  status: string;
  stripeOnboarded: boolean;
  hasStripeAccount: boolean;
  totalOrders: number;
  pendingBalanceCents: number;
  totalCommissionCents: number;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AdminAffiliatesClient() {
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    referralCode: "",
    percent: "20",
  });
  const [invite, setInvite] = useState({ name: "", email: "" });
  const [inviteLink, setInviteLink] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/affiliates", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load affiliates.");
      return;
    }
    setRows((data.affiliates || []) as AffiliateRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAffiliate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      const percent = Number(draft.percent);
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          referralCode: draft.referralCode || undefined,
          commissionRate: Number.isFinite(percent) ? percent / 100 : 0.2,
          status: "ACTIVE",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create that affiliate.");
        return;
      }
      setDraft({ name: "", email: "", password: "", referralCode: "", percent: "20" });
      setNote("Affiliate created.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function savePercent(row: AffiliateRow, percentText: string) {
    const percent = Number(percentText);
    if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
      setError("Payout percent is from 0 to 50.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/affiliates/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: percent / 100 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save that percent.");
        return;
      }
      setNote(`${row.name} now earns ${percent}% on the next paid seat.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(row: AffiliateRow, status: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/affiliates/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not update that account.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function pay(row: AffiliateRow) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch(`/api/admin/affiliates/${row.id}/payout`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Payout did not send.");
        return;
      }
      setNote(`Sent ${money(data.amountCents || 0)} to ${row.name}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    setInviteLink("");
    try {
      const res = await fetch("/api/admin/affiliates/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not send that invite.");
        return;
      }
      setInviteLink(typeof data.link === "string" ? data.link : "");
      setNote(typeof data.message === "string" ? data.message : "Invite sent.");
      setInvite({ name: "", email: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(event) => void sendInvite(event)} className="card grid gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="font-semibold">Invite someone</p>
          <p className="text-sm text-[var(--muted)]">Only John and Jeremy can send this. They open a private page and create their own account.</p>
        </div>
        <label className="text-sm">
          <span className="font-semibold">Name</span>
          <input className="input mt-1 w-full" value={invite.name} required onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">Email</span>
          <input className="input mt-1 w-full" type="email" value={invite.email} required onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold" disabled={busy}>Send invite</button>
        </div>
        {inviteLink ? (
          <label className="text-sm sm:col-span-2">
            <span className="font-semibold">Invite link</span>
            <input className="input mt-1 w-full" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
          </label>
        ) : null}
      </form>
      <form onSubmit={(event) => void createAffiliate(event)} className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-semibold">Name</span>
          <input className="input mt-1 w-full" value={draft.name} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">Email</span>
          <input className="input mt-1 w-full" type="email" value={draft.email} required onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">Password</span>
          <input className="input mt-1 w-full" type="text" value={draft.password} required minLength={8} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">Referral code</span>
          <input className="input mt-1 w-full" value={draft.referralCode} placeholder="Optional" onChange={(e) => setDraft({ ...draft, referralCode: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-semibold">Payout percent</span>
          <input className="input mt-1 w-full" inputMode="numeric" value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: e.target.value })} />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold" disabled={busy}>
            Add affiliate
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {note ? <p className="text-sm text-[var(--muted)]">{note}</p> : null}

      <ul className="space-y-3">
        {rows.length === 0 ? <li className="text-sm text-[var(--muted)]">No affiliates yet.</li> : null}
        {rows.map((row) => (
          <AffiliateCard
            key={row.id}
            row={row}
            busy={busy}
            onPercent={(percent) => void savePercent(row, percent)}
            onStatus={(status) => void setStatus(row, status)}
            onPay={() => void pay(row)}
          />
        ))}
      </ul>
    </div>
  );
}

function AffiliateCard({
  row,
  busy,
  onPercent,
  onStatus,
  onPay,
}: {
  row: AffiliateRow;
  busy: boolean;
  onPercent: (percent: string) => void;
  onStatus: (status: string) => void;
  onPay: () => void;
}) {
  const [percent, setPercent] = useState(String(Math.round(row.commissionRate * 100)));
  useEffect(() => {
    setPercent(String(Math.round(row.commissionRate * 100)));
  }, [row.commissionRate]);
  return (
    <li className="card space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{row.name}</p>
        <p className="text-[var(--muted)]">{row.status.toLowerCase()}</p>
      </div>
      <p className="text-[var(--muted)]">
        {row.email} · /{row.vanityPath || row.referralCode.toLowerCase()} · {row.totalOrders} paid seats · waiting {money(row.pendingBalanceCents)} · earned {money(row.totalCommissionCents)}
        {row.commissionMonths ? ` · ${Math.round(row.commissionRate * 100)}% for the first ${row.commissionMonths} months of each membership` : ""}
      </p>
      <p className="text-[var(--muted)]">
        Stripe {row.stripeOnboarded ? "connected" : row.hasStripeAccount ? "started, not finished" : "not connected"}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="font-semibold">Payout percent</span>
          <input className="input mt-1 w-24" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
        <button type="button" className="btn-primary px-3 py-2 text-sm font-semibold" disabled={busy} onClick={() => onPercent(percent)}>
          Save percent
        </button>
        {row.status !== "ACTIVE" ? (
          <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2" disabled={busy} onClick={() => onStatus("ACTIVE")}>
            Approve
          </button>
        ) : (
          <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2" disabled={busy} onClick={() => onStatus("PAUSED")}>
            Pause
          </button>
        )}
        <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2" disabled={busy} onClick={onPay}>
          Pay with Stripe
        </button>
        <button
          type="button"
          className="text-[var(--muted)] underline"
          disabled={busy}
          onClick={() =>
            void fetch(`/api/admin/affiliates/${row.id}/reset-password`, { method: "POST" }).then(async (res) => {
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                window.alert(typeof body.error === "string" ? body.error : "Could not send the reset email.");
                return;
              }
              window.alert(typeof body.message === "string" ? body.message : "Reset email sent.");
            })
          }
        >
          Email reset link
        </button>
        {row.status !== "TERMINATED" ? (
          <button type="button" className="text-[var(--muted)] underline" disabled={busy} onClick={() => onStatus("TERMINATED")}>
            Close
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--muted)]">The percent applies to the next paid seat. Seats already counted keep the rate they earned.</p>
    </li>
  );
}
