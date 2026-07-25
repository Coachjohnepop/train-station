"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Promo = {
  id: string;
  code: string;
  active: boolean;
  couponId: string;
  couponSummary: string;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
};

type Coupon = {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOffLabel: string | null;
  duration: string;
  timesRedeemed: number;
  valid: boolean;
};

function statusPill(status: string, tone?: "ok" | "warn" | "bad" | "muted") {
  const colors =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-200"
        : tone === "bad"
          ? "bg-rose-500/15 text-rose-300"
          : "bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}
    >
      {status}
    </span>
  );
}

/**
 * Create / list Stripe promotion codes (discount codes).
 * Used on coach Discounts page and Platform → Billing → Discounts.
 */
export default function AdminDiscountsPanel({
  showBillingLink = false,
}: {
  /** When true, link back to full Billing desk (coach-facing page). */
  showBillingLink?: boolean;
}) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [discountMsg, setDiscountMsg] = useState("");
  const [discountForm, setDiscountForm] = useState({
    code: "",
    name: "",
    kind: "percent" as "percent" | "amount",
    percentOff: "50",
    amountDollars: "5",
    duration: "repeating" as "once" | "repeating" | "forever",
    durationInMonths: "3",
    maxRedemptions: "",
    appliesTo: "subscription" as "subscription" | "one_time" | "all",
    saveAsAppReferral: true,
  });

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/billing/discounts", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Discounts failed");
      setPromos(body.promotionCodes || []);
      setCoupons(body.coupons || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiscounts();
  }, [loadDiscounts]);

  async function createDiscount() {
    setBusy(true);
    setDiscountMsg("");
    const payload = {
      code: discountForm.code.trim().toUpperCase(),
      name: discountForm.name.trim() || discountForm.code.trim().toUpperCase(),
      percentOff:
        discountForm.kind === "percent" ? Number(discountForm.percentOff) : null,
      amountOffCents:
        discountForm.kind === "amount"
          ? Math.round(Number(discountForm.amountDollars) * 100)
          : null,
      duration: discountForm.duration,
      durationInMonths:
        discountForm.duration === "repeating"
          ? Number(discountForm.durationInMonths) || 1
          : null,
      maxRedemptions: discountForm.maxRedemptions
        ? Number(discountForm.maxRedemptions)
        : null,
      appliesTo: discountForm.appliesTo,
      saveAsAppReferral: discountForm.saveAsAppReferral,
    };
    const res = await fetch("/api/admin/billing/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setDiscountMsg(body.error || "Could not create discount");
      return;
    }
    const scope =
      body.appliesTo === "subscription"
        ? "recurring memberships"
        : body.appliesTo === "one_time"
          ? "one-time packages"
          : "all products";
    setDiscountMsg(
      `Created ${body.code || payload.code} · coupon ${body.couponId} · ${scope}${
        body.referralSaved ? " · app map" : ""
      }${body.warning ? ` · ⚠ ${body.warning}` : ""}`,
    );
    setDiscountForm((f) => ({ ...f, code: "", name: "" }));
    await loadDiscounts();
  }

  async function togglePromo(promo: Promo) {
    setBusy(true);
    const res = await fetch("/api/admin/billing/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionCodeId: promo.id, active: !promo.active }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not update promo");
      return;
    }
    await loadDiscounts();
  }

  return (
    <div className="space-y-4">
      {showBillingLink ? (
        <p className="text-xs text-[var(--muted)]">
          Full money desk (transactions, refunds, subscriptions) is under Platform →{" "}
          <Link href="/admin/billing" className="text-accent hover:underline">
            Billing
          </Link>
          .
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading discounts…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold">Create discount code</h2>
            <p className="text-xs text-[var(--muted)]">
              Creates a Stripe coupon + promotion code on the{" "}
              <strong className="text-[var(--text)]">same account as STRIPE_SECRET_KEY</strong>{" "}
              (Live keys → Live codes; Test keys → Test codes). Members enter it on{" "}
              <strong className="text-[var(--text)]">Checkout</strong> (or{" "}
              <code className="text-[10px]">?promo=CODE</code>). Primary use:{" "}
              <strong className="text-[var(--text)]">% off for N months</strong> on recurring
              memberships (e.g. feedback guests — 50% × 3 months).
            </p>
            <p className="text-[11px] text-amber-200/90">
              Codes created in Test mode do not work after you flip to Live — create them again
              here once Live keys are on Production.
            </p>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="btn-ghost text-[10px] ring-1 ring-violet-500/40"
                onClick={() =>
                  setDiscountForm({
                    ...discountForm,
                    kind: "percent",
                    percentOff: "50",
                    duration: "repeating",
                    durationInMonths: "3",
                    appliesTo: "subscription",
                    name: "Feedback · 50% × 3 months",
                    code: discountForm.code || "FEEDBACK50",
                  })
                }
              >
                Preset: 50% × 3 mo (recurring)
              </button>
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() =>
                  setDiscountForm({
                    ...discountForm,
                    kind: "percent",
                    percentOff: "100",
                    duration: "repeating",
                    durationInMonths: "1",
                    appliesTo: "subscription",
                    name: "First month free",
                    code: discountForm.code || "FIRSTFREE",
                  })
                }
              >
                Preset: 100% × 1 mo
              </button>
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() =>
                  setDiscountForm({
                    ...discountForm,
                    kind: "percent",
                    percentOff: "20",
                    duration: "once",
                    appliesTo: "one_time",
                    name: "One-time package 20% off",
                    code: discountForm.code || "ONETIME20",
                  })
                }
              >
                Preset: 20% one-time (ready, unused)
              </button>
            </div>

            <label className="block text-sm">
              <span className="text-[var(--muted)]">Code</span>
              <input
                className="input mt-1 w-full uppercase"
                value={discountForm.code}
                onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value })}
                placeholder="FEEDBACK50"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Label (optional)</span>
              <input
                className="input mt-1 w-full"
                value={discountForm.name}
                onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                placeholder="Feedback · 50% × 3 months"
              />
            </label>

            <div>
              <p className="mb-1.5 text-xs text-[var(--muted)]">Applies to</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["subscription", "Recurring only"],
                    ["one_time", "One-time only"],
                    ["all", "All products"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn-ghost text-xs ${
                      discountForm.appliesTo === id ? "ring-1 ring-accent" : ""
                    }`}
                    onClick={() => setDiscountForm({ ...discountForm, appliesTo: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Recurring = Coach + Business. One-time = 1st Class package (built, not required
                yet).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn-ghost text-xs ${
                  discountForm.kind === "percent" ? "ring-1 ring-accent" : ""
                }`}
                onClick={() => setDiscountForm({ ...discountForm, kind: "percent" })}
              >
                % off
              </button>
              <button
                type="button"
                className={`btn-ghost text-xs ${
                  discountForm.kind === "amount" ? "ring-1 ring-accent" : ""
                }`}
                onClick={() => setDiscountForm({ ...discountForm, kind: "amount" })}
              >
                $ off
              </button>
            </div>
            {discountForm.kind === "percent" ? (
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Percent off</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  min={1}
                  max={100}
                  value={discountForm.percentOff}
                  onChange={(e) =>
                    setDiscountForm({ ...discountForm, percentOff: e.target.value })
                  }
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Amount off (USD)</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={discountForm.amountDollars}
                  onChange={(e) =>
                    setDiscountForm({ ...discountForm, amountDollars: e.target.value })
                  }
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Duration</span>
              <select
                className="input mt-1 w-full"
                value={discountForm.duration}
                onChange={(e) =>
                  setDiscountForm({
                    ...discountForm,
                    duration: e.target.value as "once" | "repeating" | "forever",
                  })
                }
              >
                <option value="once">Once (first invoice / one-time charge)</option>
                <option value="repeating">Repeating (N months of subscription)</option>
                <option value="forever">Forever</option>
              </select>
            </label>
            {discountForm.duration === "repeating" && (
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Months at discount</span>
                <input
                  className="input mt-1 w-full"
                  type="number"
                  min={1}
                  max={36}
                  value={discountForm.durationInMonths}
                  onChange={(e) =>
                    setDiscountForm({ ...discountForm, durationInMonths: e.target.value })
                  }
                />
                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                  e.g. 3 = first three monthly invoices at the discounted rate, then full price.
                </span>
              </label>
            )}
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Max redemptions (optional)</span>
              <input
                className="input mt-1 w-full"
                type="number"
                min={1}
                value={discountForm.maxRedemptions}
                onChange={(e) =>
                  setDiscountForm({ ...discountForm, maxRedemptions: e.target.value })
                }
                placeholder="Unlimited"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={discountForm.saveAsAppReferral}
                onChange={(e) =>
                  setDiscountForm({ ...discountForm, saveAsAppReferral: e.target.checked })
                }
              />
              Save to app referral map (also works with <code className="text-[10px]">?promo=</code>)
            </label>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy || discountForm.code.trim().length < 2}
              onClick={() => void createDiscount()}
            >
              {busy ? "Creating…" : "Create discount"}
            </button>
            {discountMsg ? (
              <p className="text-xs text-[var(--muted)]">{discountMsg}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="card overflow-x-auto p-0">
              <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Promotion codes
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Offer</th>
                    <th className="px-3 py-2">Uses</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">
                        {p.couponSummary}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.timesRedeemed}
                        {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {statusPill(p.active ? "active" : "off", p.active ? "ok" : "muted")}{" "}
                        <button
                          type="button"
                          className="btn-ghost text-[10px]"
                          disabled={busy}
                          onClick={() => void togglePromo(p)}
                        >
                          {p.active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {promos.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-xs text-[var(--muted)]"
                      >
                        No promotion codes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card overflow-x-auto p-0">
              <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Coupons
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Redeemed</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.name || c.id}</div>
                        <div className="font-mono text-[10px] text-[var(--muted)]">{c.id}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.percentOff != null ? `${c.percentOff}%` : c.amountOffLabel || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{c.duration}</td>
                      <td className="px-3 py-2 text-xs">{c.timesRedeemed}</td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-xs text-[var(--muted)]"
                      >
                        No coupons yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Referral ID map (manual Stripe IDs) still lives under{" "}
              <Link href="/admin/commission" className="text-accent hover:underline">
                Dev &amp; partnership → Referral discounts
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
