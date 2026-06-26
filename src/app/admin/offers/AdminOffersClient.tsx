"use client";

import { useCallback, useEffect, useState } from "react";
import { WEEKDAY_OPTIONS, formatCustomTrainingSummary } from "@/lib/product-offers";

type CustomOffer = {
  id: string;
  label: string;
  memberEmail: string | null;
  priceCents: number;
  status: string;
  parameters: {
    daysPerWeek: number;
    minutesPerSession: number;
    sessionsPerDay: number;
    dropInDays: string[];
    notes: string | null;
  };
  checkoutUrl: string;
};

type MerchSku = {
  id: string;
  name: string;
  priceLabel: string;
  stripePriceId: string | null;
  enabled: boolean;
};

const emptyTrainingForm = {
  label: "",
  memberEmail: "",
  priceDollars: "",
  daysPerWeek: "3",
  minutesPerSession: "60",
  sessionsPerDay: "1",
  dropInDays: [] as string[],
  notes: "",
};

const emptyMerchForm = {
  name: "",
  description: "",
  priceDollars: "",
  stripePriceId: "",
};

export default function AdminOffersClient() {
  const [offers, setOffers] = useState<CustomOffer[]>([]);
  const [skus, setSkus] = useState<MerchSku[]>([]);
  const [trainingForm, setTrainingForm] = useState(emptyTrainingForm);
  const [merchForm, setMerchForm] = useState(emptyMerchForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [trainingRes, merchRes] = await Promise.all([
      fetch("/api/admin/custom-training"),
      fetch("/api/admin/merchandise"),
    ]);
    const trainingBody = await trainingRes.json().catch(() => ({}));
    const merchBody = await merchRes.json().catch(() => ({}));
    if (trainingRes.ok) setOffers(trainingBody.offers || []);
    if (merchRes.ok) setSkus(merchBody.skus || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTrainingOffer() {
    setBusy(true);
    setError("");
    const priceCents = Math.round(Number(trainingForm.priceDollars) * 100);
    const res = await fetch("/api/admin/custom-training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: trainingForm.label.trim(),
        memberEmail: trainingForm.memberEmail.trim() || null,
        priceCents,
        notes: trainingForm.notes.trim() || null,
        parameters: {
          daysPerWeek: Number(trainingForm.daysPerWeek) || 3,
          minutesPerSession: Number(trainingForm.minutesPerSession) || 60,
          sessionsPerDay: Number(trainingForm.sessionsPerDay) || 1,
          dropInDays: trainingForm.dropInDays,
          notes: trainingForm.notes.trim() || null,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not create offer.");
    } else {
      setTrainingForm(emptyTrainingForm);
      if (body.checkoutUrl) {
        await navigator.clipboard.writeText(body.checkoutUrl).catch(() => {});
      }
      await load();
    }
    setBusy(false);
  }

  async function createMerchSku() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/merchandise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: merchForm.name.trim(),
        description: merchForm.description.trim() || null,
        priceCents: Math.round(Number(merchForm.priceDollars) * 100),
        stripePriceId: merchForm.stripePriceId.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not add merchandise.");
    } else {
      setMerchForm(emptyMerchForm);
      await load();
    }
    setBusy(false);
  }

  function toggleDropInDay(day: string) {
    setTrainingForm((f) => ({
      ...f,
      dropInDays: f.dropInDays.includes(day)
        ? f.dropInDays.filter((d) => d !== day)
        : [...f.dropInDays, day],
    }));
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">
          Custom priced training
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Set training parameters and price, then send the checkout link to the member.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Offer label"
            value={trainingForm.label}
            onChange={(e) => setTrainingForm((f) => ({ ...f, label: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Member email (optional)"
            value={trainingForm.memberEmail}
            onChange={(e) => setTrainingForm((f) => ({ ...f, memberEmail: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Price (USD)"
            type="number"
            min={0}
            step="0.01"
            value={trainingForm.priceDollars}
            onChange={(e) => setTrainingForm((f) => ({ ...f, priceDollars: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Days per week"
            type="number"
            min={1}
            max={7}
            value={trainingForm.daysPerWeek}
            onChange={(e) => setTrainingForm((f) => ({ ...f, daysPerWeek: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Minutes per session"
            type="number"
            min={15}
            value={trainingForm.minutesPerSession}
            onChange={(e) =>
              setTrainingForm((f) => ({ ...f, minutesPerSession: e.target.value }))
            }
          />
          <input
            className="input"
            placeholder="Sessions per day"
            type="number"
            min={1}
            max={4}
            value={trainingForm.sessionsPerDay}
            onChange={(e) => setTrainingForm((f) => ({ ...f, sessionsPerDay: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <button
              key={day.id}
              type="button"
              className={`rounded-full px-2 py-1 text-xs ${
                trainingForm.dropInDays.includes(day.id)
                  ? "nav-tab-active text-accent"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
              onClick={() => toggleDropInDay(day.id)}
            >
              {day.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy || !trainingForm.label.trim() || !trainingForm.priceDollars}
          onClick={() => void createTrainingOffer()}
        >
          Create &amp; copy checkout link
        </button>

        {offers.length > 0 && (
          <div className="space-y-2 border-t border-[var(--border)] pt-4 text-sm">
            {offers.slice(0, 8).map((offer) => (
              <div key={offer.id} className="rounded-lg bg-[var(--surface-2)] p-3">
                <div className="font-medium">{offer.label}</div>
                <div className="text-xs text-[var(--muted)]">
                  ${(offer.priceCents / 100).toFixed(2)} · {offer.status} ·{" "}
                  {formatCustomTrainingSummary(offer.parameters)}
                </div>
                <a href={offer.checkoutUrl} className="text-xs text-accent hover:underline">
                  Checkout link
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[2px] text-accent">Merchandise</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Item name"
            value={merchForm.name}
            onChange={(e) => setMerchForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Price (USD)"
            type="number"
            min={0}
            step="0.01"
            value={merchForm.priceDollars}
            onChange={(e) => setMerchForm((f) => ({ ...f, priceDollars: e.target.value }))}
          />
          <input
            className="input sm:col-span-2"
            placeholder="Stripe price id (price_…)"
            value={merchForm.stripePriceId}
            onChange={(e) => setMerchForm((f) => ({ ...f, stripePriceId: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy || !merchForm.name.trim() || !merchForm.priceDollars}
          onClick={() => void createMerchSku()}
        >
          Add merchandise SKU
        </button>
        {skus.length > 0 && (
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {skus.map((sku) => (
              <li key={sku.id}>
                {sku.name} — {sku.priceLabel}
                {sku.stripePriceId ? ` · ${sku.stripePriceId}` : " · no Stripe price"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}