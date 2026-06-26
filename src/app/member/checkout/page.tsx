"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

type PaymentsPublic = {
  stripeEnabled: boolean;
  memberships: Array<{
    plan: string;
    label: string;
    priceLabel: string;
    checkoutMode: string;
    stripeReady: boolean;
  }>;
  merchandise: Array<{
    id: string;
    name: string;
    priceLabel: string;
    stripeReady: boolean;
  }>;
  venmo: {
    qrUrl: string | null;
    handle: string | null;
    instructions: string | null;
    hasQr: boolean;
  };
};

function planPriceLabel(plan: string, payments: PaymentsPublic | null): string {
  if (!payments) return "";
  const match = payments.memberships?.find((m) => m.plan === plan);
  return match?.priceLabel || "";
}

function MemberCheckoutInner() {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || "member");
  const customOfferId = searchParams.get("offerId") || "";
  const merchandiseSkuId = searchParams.get("sku") || "";
  const canceled = searchParams.get("canceled") === "1";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsPublic | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [referralCode, setReferralCode] = useState(
    () => searchParams.get("ref") || searchParams.get("referral") || "",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/payments/public");
      const data = await res.json().catch(() => ({}));
      if (!cancelled) {
        setPayments(res.ok ? data : null);
        setPaymentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const membershipOffer = payments?.memberships?.find((m) => m.plan === plan);
  const merchOffer = payments?.merchandise?.find((m) => m.id === merchandiseSkuId);
  const stripeReady =
    payments?.stripeEnabled &&
    (plan === "custom_training"
      ? Boolean(customOfferId)
      : plan === "merchandise"
        ? Boolean(merchOffer?.stripeReady)
        : Boolean(membershipOffer?.stripeReady));

  const venmoReady = Boolean(payments?.venmo?.hasQr);
  const priceLabel = planPriceLabel(plan, payments);

  useEffect(() => {
    if (paymentsLoading || canceled || !stripeReady || venmoReady) return;
    void startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsLoading, canceled, stripeReady, venmoReady]);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          referralCode: referralCode.trim() || undefined,
          customOfferId: customOfferId || undefined,
          merchandiseSkuId: merchandiseSkuId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      setError(data.error || "Could not start checkout.");
    } catch {
      setError("Could not reach checkout. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-5 p-6">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[3px] text-accent">
            Membership checkout
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {signupPlanLabel(plan)}
          </h1>
          {priceLabel && (
            <p className="mt-1 text-sm font-medium text-white">{priceLabel}</p>
          )}
          <p className="mt-2 text-sm text-[var(--muted)]">
            {canceled
              ? "Checkout was canceled. Pick Stripe or Venmo when you are ready."
              : paymentsLoading
                ? "Loading payment options…"
                : "Complete payment to unlock onboarding and your training dashboard."}
          </p>
        </div>

        {error && <p className="text-sm text-amber-400">{error}</p>}

        {stripeReady && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-[2px] text-[var(--muted)]">
                Referral or promo code
              </label>
              <input
                className="input w-full"
                placeholder="Optional — e.g. FRIEND10"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                autoCapitalize="characters"
              />
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Applied at Stripe checkout when configured. You can also enter a code on the Stripe
                page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Opening Stripe…" : "Pay with Stripe"}
            </button>
          </div>
        )}

        {!paymentsLoading && !stripeReady && !venmoReady && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Online checkout is not configured yet. Contact Jeremy to complete signup.
          </p>
        )}

        {venmoReady && payments?.venmo && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-accent">
                Or pay with Venmo
              </p>
              {payments.venmo.handle && (
                <p className="mt-1 text-sm font-medium">{payments.venmo.handle}</p>
              )}
            </div>
            <div className="mx-auto max-w-[200px] overflow-hidden rounded-lg bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payments.venmo.qrUrl!}
                alt="Venmo QR code"
                className="h-auto w-full"
              />
            </div>
            <p className="text-center text-xs text-[var(--muted)]">
              {payments.venmo.instructions ||
                "Scan to pay, include your name in the note. Jeremy will confirm and unlock your account."}
            </p>
          </div>
        )}

        <Link href="/" className="block text-center text-xs text-[var(--muted)] hover:text-accent">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function MemberCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6 text-center text-sm text-[var(--muted)]">
          Loading checkout…
        </div>
      }
    >
      <MemberCheckoutInner />
    </Suspense>
  );
}