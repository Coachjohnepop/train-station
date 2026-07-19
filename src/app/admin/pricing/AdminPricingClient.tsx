"use client";

import { useCallback, useEffect, useState } from "react";

type PricingOffer = {
  id: string;
  label: string;
  shortLabel: string;
  checkoutMode: string;
  priceLabel: string;
  priceNote?: string;
  priceDisplay: string;
  priceCents: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  adminConfigured: boolean;
  description: string;
};

type PricingSnapshot = {
  offers: PricingOffer[];
  stripeConnected: boolean;
};

type PlanDraft = {
  label: string;
  priceDollars: string;
  enabled: boolean;
};

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export default function AdminPricingClient() {
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/pricing");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not load pricing.");
      setSnapshot(null);
    } else {
      setSnapshot(body);
      const next: Record<string, PlanDraft> = {};
      for (const offer of body.offers as PricingOffer[]) {
        next[offer.id] = {
          label: offer.label,
          priceDollars: dollarsFromCents(offer.priceCents),
          enabled: true,
        };
      }
      setDrafts(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(planId: string, patch: Partial<PlanDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], ...patch },
    }));
  }

  async function savePlan(planId: string, syncStripe: boolean) {
    const draft = drafts[planId];
    if (!draft) return;
    const priceDollars = Number(draft.priceDollars);
    if (!Number.isFinite(priceDollars) || priceDollars < 0) {
      setError("Enter a valid price.");
      return;
    }

    setBusyPlan(planId);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        label: draft.label.trim(),
        priceDollars,
        enabled: draft.enabled,
        syncStripe,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyPlan(null);

    if (!res.ok) {
      setError(body.error || "Could not save pricing.");
      return;
    }

    setSnapshot(body.snapshot);
    setMessage(
      body.message ||
        (syncStripe
          ? "Stripe price synced — landing and checkout updated."
          : "Display price saved. Checkout still uses the saved Stripe price until you sync."),
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading membership pricing…</p>;
  }

  if (error && !snapshot) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-4 text-sm text-[var(--muted)]">
        <p className="font-medium text-white">Membership packages — two fee types</p>
        <p className="mt-2">
          Every paid package is either a{" "}
          <span className="text-white">monthly subscription</span> (recurring) or a{" "}
          <span className="text-white">one-time fee</span> (pay once). Dollar amounts can
          change; the fee type stays the same for checkout (Stripe subscription vs payment mode).
        </p>
        <p className="mt-2">
          Use <span className="text-white">Save display only</span> for landing labels, or{" "}
          <span className="text-white">Save &amp; sync Stripe</span> to create a new Stripe price
          and point checkout at it.
        </p>
        <p className="mt-2">
          Stripe status:{" "}
          <span className={snapshot?.stripeConnected ? "text-emerald-400" : "text-amber-300"}>
            {snapshot?.stripeConnected ? "Connected" : "Not connected — set STRIPE_SECRET_KEY"}
          </span>
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {message}
        </div>
      )}
      {error && snapshot && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {snapshot?.offers.map((offer) => {
          const draft = drafts[offer.id];
          if (!draft) return null;
          const isSubscription = offer.checkoutMode === "subscription";
          const isBusy = busyPlan === offer.id;

          return (
            <div key={offer.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{offer.shortLabel}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isSubscription
                          ? "bg-sky-500/20 text-sky-200"
                          : "bg-amber-500/20 text-amber-100"
                      }`}
                    >
                      {isSubscription ? "Monthly subscription" : "One-time fee"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{offer.description}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Stripe checkout mode: {isSubscription ? "subscription" : "payment"} · Live
                    display: {offer.priceDisplay}
                  </p>
                </div>
                {offer.stripePriceId && (
                  <code className="max-w-full truncate rounded bg-black/30 px-2 py-1 text-[10px] text-[#c4b5fd]">
                    {offer.stripePriceId}
                  </code>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Display name</span>
                  <input
                    className="input mt-1 w-full"
                    value={draft.label}
                    onChange={(e) => updateDraft(offer.id, { label: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">
                    Price (USD){isSubscription ? " / month" : ""}
                  </span>
                  <input
                    className="input mt-1 w-full"
                    type="number"
                    min={0}
                    step={isSubscription ? 1 : 0.01}
                    value={draft.priceDollars}
                    onChange={(e) => updateDraft(offer.id, { priceDollars: e.target.value })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={isBusy}
                  onClick={() => void savePlan(offer.id, false)}
                >
                  {isBusy ? "Saving…" : "Save display only"}
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={isBusy || !snapshot.stripeConnected}
                  onClick={() => void savePlan(offer.id, true)}
                >
                  {isBusy ? "Syncing…" : "Save & sync Stripe"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}