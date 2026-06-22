"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

type PaymentsPublic = {
  stripeEnabled: boolean;
  coachClass: { plan: string; priceLabel: string; stripeReady: boolean };
  firstClass: { plan: string; priceLabel: string; stripeReady: boolean };
  venmo: {
    qrUrl: string | null;
    handle: string | null;
    instructions: string | null;
    hasQr: boolean;
  };
};

function planPriceLabel(plan: string, payments: PaymentsPublic | null): string {
  if (!payments) return "";
  if (plan === "pro") return payments.firstClass.priceLabel;
  if (plan === "member") return payments.coachClass.priceLabel;
  return "";
}

function MemberCheckoutInner() {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || "member");
  const canceled = searchParams.get("canceled") === "1";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsPublic | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

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

  const stripeReady =
    payments?.stripeEnabled &&
    (plan === "pro"
      ? payments.firstClass.stripeReady
      : plan === "member"
        ? payments.coachClass.stripeReady
        : false);

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
        body: JSON.stringify({ plan }),
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
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Opening Stripe…" : "Pay with Stripe"}
          </button>
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