"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MembershipPaymentCard from "@/components/MembershipPaymentCard";
import { normalizeSignupPlan, signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import { isPaidOffer } from "@/lib/product-offers";

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
    if (paymentsLoading || canceled || !stripeReady || venmoReady || error) return;
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

  const showMembershipCard = isPaidOffer(plan);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      {showMembershipCard ? (
        <MembershipPaymentCard plan={plan as SignupPlan} priceLabel={priceLabel || undefined}>
          {canceled && (
            <p className="text-sm text-amber-300">
              Checkout was canceled. You can try Stripe again or use Venmo below.
            </p>
          )}
          {paymentsLoading && (
            <p className="text-sm text-[var(--muted)]">Loading payment options…</p>
          )}
          {error && <p className="text-sm text-amber-400">{error}</p>}
          {stripeReady && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void startCheckout()}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? "Opening Stripe…" : "Continue to secure checkout"}
              </button>
              <p className="text-center text-[11px] text-[var(--muted)]">
                You&apos;ll confirm the exact amount on Stripe before paying.
              </p>
            </div>
          )}
          {!paymentsLoading && !stripeReady && !venmoReady && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Online checkout is not configured yet. Contact Jeremy to complete signup.
            </p>
          )}
          {venmoReady && payments?.venmo && (
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-center text-xs font-semibold uppercase tracking-[2px] text-accent">
                Or pay with Venmo
              </p>
              {payments.venmo.handle && (
                <p className="text-center text-sm font-medium">{payments.venmo.handle}</p>
              )}
              <div className="mx-auto max-w-[200px] overflow-hidden rounded-lg bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payments.venmo.qrUrl!} alt="Venmo QR code" className="h-auto w-full" />
              </div>
              <p className="text-center text-xs text-[var(--muted)]">
                {payments.venmo.instructions ||
                  "Scan to pay and include your name in the note. Jeremy will confirm and unlock your account."}
              </p>
            </div>
          )}
          <Link href="/" className="block text-center text-xs text-[var(--muted)] hover:text-accent">
            Back to home
          </Link>
        </MembershipPaymentCard>
      ) : (
        <div className="card space-y-5 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{signupPlanLabel(plan)}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Complete checkout to continue.</p>
          </div>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          {stripeReady && (
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Opening Stripe…" : "Continue to secure checkout"}
            </button>
          )}
        </div>
      )}
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