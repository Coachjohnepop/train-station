"use client";

import { useCallback, useEffect, useState } from "react";

type Reserve = {
  stripeAvailableCents: number;
  stripePendingCents: number;
  balanceError: boolean;
  reserveTargetCents: number;
  approvedOwedCents: number;
  reserveNeededCents: number;
  safeToSweepCents: number;
};

type Activity = {
  pending: { id: string; name: string; email: string; referralCode: string }[];
  conversions: {
    id: string;
    affiliateName: string;
    plan: string | null;
    commissionCents: number;
    status: string;
    createdAt: string;
  }[];
  payouts: { id: string; affiliateName: string; amountCents: number; status: string; createdAt: string }[];
};

type ReportMonth = { month: string; revenueCents: number; commissionCents: number; orders: number };
type TopAffiliate = { id: string; name: string; revenueCents: number; commissionCents: number; orders: number; conversionRate: number };
type ProgramReport = {
  months: ReportMonth[];
  topAffiliates: TopAffiliate[];
  programSummary: {
    totalRevenueCents: number;
    totalCommissionCents: number;
    pendingBalanceCents: number;
    totalAffiliates: number;
    orders: number;
    avgOrderCents: number;
  };
};

type Promotion = {
  id: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
  endsAt: string | null;
};

function ProgramReportCard({ report }: { report: ProgramReport }) {
  const summary = report.programSummary;
  return (
    <section className="card space-y-3 p-4 text-sm">
      <h2 className="font-semibold">Program report</h2>
      <p className="text-[var(--muted)]">
        {summary.totalAffiliates} affiliates · {summary.orders} paid seats · revenue {money(summary.totalRevenueCents)} · commission {money(summary.totalCommissionCents)} · waiting {money(summary.pendingBalanceCents)} · average seat {money(summary.avgOrderCents)}
      </p>
      <table className="w-full text-left">
        <thead className="text-[var(--muted)]">
          <tr>
            <th className="py-1">Month</th>
            <th className="py-1 text-right">Seats</th>
            <th className="py-1 text-right">Revenue</th>
            <th className="py-1 text-right">Commission</th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((row) => (
            <tr key={row.month} className="border-t border-[var(--border)]">
              <td className="py-1">{row.month}</td>
              <td className="py-1 text-right tabular-nums">{row.orders}</td>
              <td className="py-1 text-right tabular-nums">{money(row.revenueCents)}</td>
              <td className="py-1 text-right tabular-nums">{money(row.commissionCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-1">
        {report.topAffiliates.map((row) => (
          <li key={row.id}>
            {row.name} · {money(row.revenueCents)} · {row.orders} seats · {row.conversionRate.toFixed(0)}% of clicks
          </li>
        ))}
      </ul>
    </section>
  );
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AdminAffiliateOps() {
  const [reserve, setReserve] = useState<Reserve | null>(null);
  const [reserveInput, setReserveInput] = useState("");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoName, setPromoName] = useState("");
  const [promoPercent, setPromoPercent] = useState("10");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSweep, setConfirmSweep] = useState(false);
  const [confirmPayAll, setConfirmPayAll] = useState(false);
  const [report, setReport] = useState<ProgramReport | null>(null);

  const load = useCallback(async () => {
    const [reserveRes, activityRes, promoRes, reportRes] = await Promise.all([
      fetch("/api/admin/affiliates/reserve", { cache: "no-store" }),
      fetch("/api/admin/affiliates/activity", { cache: "no-store" }),
      fetch("/api/admin/affiliates/promotions", { cache: "no-store" }),
      fetch("/api/admin/affiliates/analytics", { cache: "no-store" }),
    ]);
    if (reserveRes.ok) {
      const body = (await reserveRes.json()) as Reserve;
      setReserve(body);
      setReserveInput(String(Math.round(body.reserveTargetCents / 100)));
    }
    if (activityRes.ok) setActivity((await activityRes.json()) as Activity);
    if (promoRes.ok) {
      const body = (await promoRes.json()) as { promotions: Promotion[] };
      setPromotions(body.promotions || []);
    }
    if (reportRes.ok) setReport((await reportRes.json()) as ProgramReport);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveReserve() {
    const dollars = Number(reserveInput);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Reserve is a dollar amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates/reserve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserveTargetCents: Math.round(dollars * 100) }),
      });
      if (!res.ok) {
        setError("Could not save the reserve.");
        return;
      }
      setReserve((await res.json()) as Reserve);
      setNote("Reserve saved.");
    } finally {
      setBusy(false);
    }
  }

  async function sweep() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates/sweep", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Sweep did not send.");
        return;
      }
      setNote(`Sent ${money(body.amountCents || 0)} from Stripe to the bank.`);
      setConfirmSweep(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function payAll() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates/payout-all", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Pay all did not run.");
        return;
      }
      setNote(`Paid ${money(body.paidCents || 0)} across ${body.succeeded || 0} affiliates.`);
      setConfirmPayAll(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addPromo(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: promoName, discountPercent: Number(promoPercent) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not add that promotion.");
        return;
      }
      setPromoName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {report ? <ProgramReportCard report={report} /> : null}

      <section className="card space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Stripe reserve</h2>
        {reserve?.balanceError ? <p className="text-rose-300">Stripe balance could not be read.</p> : null}
        <p className="text-[var(--muted)]">
          Available {money(reserve?.stripeAvailableCents ?? 0)} · pending {money(reserve?.stripePendingCents ?? 0)} ·
          owed {money(reserve?.approvedOwedCents ?? 0)} · safe to send {money(reserve?.safeToSweepCents ?? 0)}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="font-semibold">Hold back at least</span>
            <input className="input mt-1 w-28" value={reserveInput} onChange={(e) => setReserveInput(e.target.value)} />
          </label>
          <button type="button" className="btn-primary px-3 py-2" disabled={busy} onClick={() => void saveReserve()}>
            Save reserve
          </button>
          {confirmSweep ? (
            <button type="button" className="rounded-lg border border-rose-400 px-3 py-2" disabled={busy} onClick={() => void sweep()}>
              Send {money(reserve?.safeToSweepCents ?? 0)} to the bank
            </button>
          ) : (
            <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2" disabled={busy} onClick={() => setConfirmSweep(true)}>
              Sweep excess to the bank
            </button>
          )}
          {confirmPayAll ? (
            <button type="button" className="rounded-lg border border-rose-400 px-3 py-2" disabled={busy} onClick={() => void payAll()}>
              Pay every ready affiliate
            </button>
          ) : (
            <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2" disabled={busy} onClick={() => setConfirmPayAll(true)}>
              Pay all ready
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          The sweep sends Stripe cash above the reserve to the bank. Pay all transfers unpaid commission to each connected affiliate.
        </p>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {note ? <p className="text-sm text-[var(--muted)]">{note}</p> : null}

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Activity</h2>
        <p className="text-[var(--muted)]">Waiting for approval: {(activity?.pending ?? []).map((row) => row.name).join(", ") || "none"}</p>
        <ul className="space-y-1">
          {(activity?.conversions ?? []).map((row) => (
            <li key={row.id}>
              {row.affiliateName} · {money(row.commissionCents)} · {row.plan || "membership"} · {row.status.toLowerCase()}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Promotions</h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void addPromo(event)}>
          <label>
            <span className="font-semibold">Name</span>
            <input className="input mt-1" value={promoName} required onChange={(e) => setPromoName(e.target.value)} />
          </label>
          <label>
            <span className="font-semibold">Percent off</span>
            <input className="input mt-1 w-24" value={promoPercent} onChange={(e) => setPromoPercent(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary px-3 py-2" disabled={busy}>Add</button>
        </form>
        <ul className="space-y-1">
          {promotions.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2">
              <span>{row.name} · {row.discountPercent}% · {row.isActive ? "on" : "off"}</span>
              <button
                type="button"
                className="text-[var(--muted)] underline"
                onClick={() =>
                  void fetch("/api/admin/affiliates/promotions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
                  }).then(() => load())
                }
              >
                {row.isActive ? "Turn off" : "Turn on"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
