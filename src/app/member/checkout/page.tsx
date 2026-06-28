"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmbeddedStripeCheckoutModal from "@/components/EmbeddedStripeCheckoutModal";
import MembershipPaymentCard from "@/components/MembershipPaymentCard";
import { normalizeSignupPlan, signupPlanLabel, type SignupPlan } from "@/lib/signup-plans";
import { isPaidOffer } from "@/lib/product-offers";

type PaymentsPublic = {
  stripeEnabled: boolean;
  stripePublishableKey: string | null;
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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsPublic | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [planChanging, setPlanChanging] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [paymentsRes, membershipRes] = await Promise.all([
        fetch("/api/payments/public"),
        fetch("/api/member/membership"),
      ]);
      const paymentsData = await paymentsRes.json().catch(() => ({}));
      const membershipData = await membershipRes.json().catch(() => ({}));
      if (!cancelled) {
        setPayments(paymentsRes.ok ? paymentsData : null);
        setHasSavedCard(Boolean(membershipData.hasSavedPaymentMethod));
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
    Boolean(payments.stripePublishableKey) &&
    (plan === "custom_training"
      ? Boolean(customOfferId)
      : plan === "merchandise"
        ? Boolean(merchOffer?.stripeReady)
        : Boolean(membershipOffer?.stripeReady));

  const venmoReady = Boolean(payments?.venmo?.hasQr);
  const priceLabel = planPriceLabel(plan, payments);

  const handleCheckoutComplete = useCallback(async (completedSessionId: string) => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: completedSessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirectTo) {
        setCheckoutOpen(false);
        window.location.href = data.redirectTo;
        return;
      }
      setError(data.error || "Payment confirmation failed. Contact support if you were charged.");
    } catch {
      setError("Could not confirm payment. Try again or contact support.");
    } finally {
      setConfirming(false);
    }
  }, []);

  const closeCheckout = useCallback(() => {
    if (confirming) return;
    setCheckoutOpen(false);
    setClientSecret(null);
    setSessionId(null);
  }, [confirming]);

  async function startCheckout() {
    setLoading(true);
    setPlanChanging(false);
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
      if (res.ok && data.planChanged && data.redirectTo) {
        setPlanChanging(true);
        window.location.href = data.redirectTo;
        return;
      }
      if (res.ok && data.clientSecret && data.sessionId) {
        setHasSavedCard(Boolean(data.hasSavedCard));
        setClientSecret(data.clientSecret);
        setSessionId(data.sessionId);
        setCheckoutOpen(true);
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
  const publishableKey = payments?.stripePublishableKey || "";

  return (
    <>
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
            {confirming && (
              <p className="text-sm text-[var(--muted)]">Confirming payment…</p>
            )}
            {stripeReady && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void startCheckout()}
                  disabled={loading || planChanging || confirming}
                  className="btn-primary w-full"
                >
                  {planChanging
                    ? "Updating plan…"
                    : confirming
                      ? "Confirming payment…"
                      : loading
                        ? "Preparing checkout…"
                        : checkoutOpen
                          ? "Payment window open"
                          : "Get your Ticket"}
                </button>
                <p className="text-center text-[11px] text-[var(--muted)]">
                  {hasSavedCard
                    ? "Your saved card should be pre-selected in checkout. If you only see an empty form, enter your card once more with your billing address — it will prefill next time."
                    : "After your first payment, check “save for future purchases” in checkout to reuse your card next time."}
                </p>
              </div>
            )}
            {!paymentsLoading && !stripeReady && !venmoReady && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {payments?.stripeEnabled
                  ? "This plan is not ready for card checkout yet. Contact Jeremy to complete signup."
                  : "Online checkout is not configured yet. Contact Jeremy to complete signup."}
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
            <div className="flex flex-col items-center gap-2 text-xs text-[var(--muted)]">
              <Link href="/#tickets" className="hover:text-accent">
                Compare train seats
              </Link>
              <Link href="/" className="hover:text-accent">
                Back to home
              </Link>
            </div>
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
                disabled={loading || confirming}
                className="btn-primary w-full"
              >
                {confirming
                  ? "Confirming payment…"
                  : loading
                    ? "Preparing checkout…"
                    : "Get your Ticket"}
              </button>
            )}
          </div>
        )}
      </div>

      {publishableKey && (
        <EmbeddedStripeCheckoutModal
          open={checkoutOpen}
          publishableKey={publishableKey}
          clientSecret={clientSecret}
          sessionId={sessionId}
          onClose={closeCheckout}
          onComplete={handleCheckoutComplete}
        />
      )}
    </>
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