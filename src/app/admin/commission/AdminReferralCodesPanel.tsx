"use client";

import { useCallback, useEffect, useState } from "react";

type ReferralCode = {
  id: string;
  code: string;
  label: string;
  stripePromotionCodeId: string | null;
  stripeCouponId: string | null;
  enabled: boolean;
  notes: string | null;
};

const emptyForm = {
  code: "",
  label: "",
  stripePromotionCodeId: "",
  stripeCouponId: "",
  notes: "",
};

export default function AdminReferralCodesPanel() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/referral-codes");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not load referral codes.");
      setCodes([]);
    } else {
      setCodes(body.codes || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCode() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/referral-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code.trim(),
        label: form.label.trim() || form.code.trim(),
        stripePromotionCodeId: form.stripePromotionCodeId.trim() || null,
        stripeCouponId: form.stripeCouponId.trim() || null,
        notes: form.notes.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not add referral code.");
    } else {
      setForm(emptyForm);
      await load();
    }
    setBusy(false);
  }

  async function toggleEnabled(code: ReferralCode) {
    setBusy(true);
    const res = await fetch("/api/admin/referral-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: code.id, enabled: !code.enabled }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not update referral code.");
    } else {
      await load();
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
          Referral discounts
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Map member-facing codes (signup <code className="text-xs">?ref=CODE</code> or checkout)
          to Stripe promotion codes or coupons. Members can also enter codes on the Stripe checkout
          page.
        </p>
      </div>

      {error && <p className="text-sm text-amber-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading referral codes…</p>
      ) : codes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Stripe</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-2 py-3">
                    <div className="font-medium">{code.code}</div>
                    <div className="text-xs text-[var(--muted)]">{code.label}</div>
                  </td>
                  <td className="px-2 py-3 text-xs text-[var(--muted)]">
                    {code.stripePromotionCodeId || code.stripeCouponId || "—"}
                  </td>
                  <td className="px-2 py-3 text-xs">
                    {code.enabled ? (
                      <span className="text-emerald-300">Active</span>
                    ) : (
                      <span className="text-amber-300">Disabled</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      className="btn-ghost text-[10px] px-2 py-1"
                      disabled={busy}
                      onClick={() => void toggleEnabled(code)}
                    >
                      {code.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No referral codes yet.</p>
      )}

      <div className="grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Code (e.g. FRIEND10)"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Stripe promotion code id (promo_…)"
          value={form.stripePromotionCodeId}
          onChange={(e) => setForm((f) => ({ ...f, stripePromotionCodeId: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Or coupon id (coupon_…)"
          value={form.stripeCouponId}
          onChange={(e) => setForm((f) => ({ ...f, stripeCouponId: e.target.value }))}
        />
      </div>
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={busy || !form.code.trim()}
        onClick={() => void addCode()}
      >
        Add referral code
      </button>
    </div>
  );
}