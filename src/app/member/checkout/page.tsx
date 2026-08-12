"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmbeddedStripeCheckoutModal from "@/components/EmbeddedStripeCheckoutModal";
import CheckoutUpgradeOptions from "@/components/CheckoutUpgradeOptions";
import MembershipPaymentCard from "@/components/MembershipPaymentCard";
import MembershipTicketGrid from "@/components/MembershipTicketGrid";
import {
  isMembershipPlan,
  normalizeSignupPlan,
  signupPlanLabel,
  upgradeMembershipPlansFrom,
  type SignupPlan,
} from "@/lib/signup-plans";
import { isPaidOffer } from "@/lib/product-offers";

type PaymentsPublic = {
  stripeEnabled: boolean;
  stripeConfigured?: boolean;
  publicCardCheckout?: boolean;
  stripePublishableKey: string | null;
  memberships: Array<{
    plan: string;
    label: string;
    priceLabel: string;
    checkoutMode: string;
    feeCategory?: "subscription" | "one_time" | null;
    feeCategoryLabel?: string;
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
  tips?: {
    enabled: boolean;
    presets: number[];
    customEnabled: boolean;
  };
};

function planPriceLabel(plan: string, payments: PaymentsPublic | null): string {
  if (!payments) return "";
  const match = payments.memberships?.find((m) => m.plan === plan);
  return match?.priceLabel || "";
}

function planFeeLabel(plan: string, payments: PaymentsPublic | null): string {
  if (!payments) return "";
  const match = payments.memberships?.find((m) => m.plan === plan);
  if (match?.feeCategoryLabel) return match.feeCategoryLabel;
  if (match?.checkoutMode === "subscription") return "Monthly subscription";
  if (match?.checkoutMode === "one_time") return "One-time fee";
  if (plan === "custom_training" || plan === "merchandise") return "One-time fee";
  return "";
}

function MemberCheckoutInner() {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || "member");
  const customOfferId = searchParams.get("offerId") || "";
  const merchandiseSkuId = searchParams.get("sku") || "";
  const canceled = searchParams.get("canceled") === "1";
  const isDowngradeIntent = searchParams.get("intent") === "downgrade";
  const promoFromUrl =
    searchParams.get("promo") || searchParams.get("code") || searchParams.get("ref") || "";
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsPublic | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [planChanging, setPlanChanging] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [promoCode, setPromoCode] = useState(promoFromUrl.toUpperCase());
  const [promoHint, setPromoHint] = useState<string | null>(
    promoFromUrl ? `Code ${promoFromUrl.toUpperCase()} will apply at checkout.` : null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [paymentsRes, membershipRes, gatesRes] = await Promise.all([
        fetch("/api/payments/public"),
        fetch("/api/member/membership"),
        // Re-sync gate cookies every checkout visit (webhook may have paid without clearing browser cookies).
        fetch("/api/member/sync-gates", { method: "POST", credentials: "same-origin", cache: "no-store" }),
      ]);
      const paymentsData = await paymentsRes.json().catch(() => ({}));
      const membershipData = await membershipRes.json().catch(() => ({}));
      const gatesData = await gatesRes.json().catch(() => ({}));
      if (cancelled) return;

      setPayments(paymentsRes.ok ? paymentsData : null);
      setHasSavedCard(Boolean(membershipData.hasSavedPaymentMethod));
      const status =
        typeof membershipData.paymentStatus === "string" ? membershipData.paymentStatus : null;
      setPaymentStatus(status);
      setPaymentsLoading(false);

      // Paid signup (not intentional upgrade/downgrade): leave checkout for onboard/Today.
      // Fixes Ali-style “ticket paid but stuck on Get your Ticket”.
      if (
        !isDowngradeIntent &&
        status === "paid" &&
        gatesRes.ok &&
        typeof gatesData.redirectTo === "string" &&
        gatesData.redirectTo &&
        !gatesData.needsPayment
      ) {
        // Stay on checkout only when they are upgrading to a different plan (URL plan ≠ profile).
        const profilePlan =
          typeof membershipData.plan === "string" ? membershipData.plan : null;
        const sameTicket = !profilePlan || profilePlan === plan;
        if (sameTicket) {
          window.location.replace(gatesData.redirectTo as string);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDowngradeIntent, plan]);

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
  const feeLabel = planFeeLabel(plan, payments);

  /** After Stripe finishes, land on the confirmation page (user advances manually). */
  const handleCheckoutComplete = useCallback((completedSessionId: string) => {
    setCheckoutOpen(false);
    setConfirming(false);
    window.location.href = `/member/checkout/success?session_id=${encodeURIComponent(completedSessionId)}`;
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
          promoCode: promoCode.trim() || undefined,
          referralCode: promoCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.planChanged && data.redirectTo) {
        setPlanChanging(true);
        window.location.href = data.redirectTo;
        return;
      }
      if (res.ok && data.alreadyPaid && data.redirectTo) {
        window.location.replace(data.redirectTo);
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
  const isSignupCheckout = paymentStatus !== "paid";
  // Never offer upgrades while intentionally downgrading from Account.
  const upgradePlans =
    !isDowngradeIntent && isSignupCheckout && isMembershipPlan(plan)
      ? upgradeMembershipPlansFrom(plan)
      : [];
  const payCta = isDowngradeIntent
    ? `Confirm ${signupPlanLabel(plan)}`
    : "Get your Ticket";

  return (
    <>
      <div
        className={
          showMembershipCard
            ? "mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10"
            : "mx-auto min-h-[70vh] max-w-4xl px-3 py-8 sm:px-6 sm:py-12"
        }
      >
        {showMembershipCard ? (
          <MembershipPaymentCard plan={plan as SignupPlan} priceLabel={priceLabel || undefined}>
            {isDowngradeIntent && (
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                <p className="font-semibold">Downgrade checkout</p>
                <p className="mt-1 text-xs text-rose-100/90">
                  You chose a lower ticket from Account. Confirm payment below, or go back and keep
                  your current plan.
                </p>
                <Link
                  href="/member/account"
                  className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
                >
                  ← Back to Account
                </Link>
              </div>
            )}
            {feeLabel ? (
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent-fg)]">
                {feeLabel}
                {priceLabel ? ` · ${priceLabel}` : ""}
              </p>
            ) : null}
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
            {stripeReady && !isDowngradeIntent && (
              <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <label className="block text-xs font-semibold text-[var(--text)]" htmlFor="promo-code">
                  Discount code
                </label>
                <p className="text-[11px] text-[var(--muted)]">
                  Early members / feedback guests — enter the code Jeremy shared (e.g. 50% off first
                  months). Leave blank if you don’t have one.
                </p>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    className="input flex-1 uppercase tracking-wide"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="FEEDBACK50"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoHint(null);
                    }}
                    disabled={loading || confirming || checkoutOpen}
                  />
                </div>
                {promoHint && (
                  <p className="text-[11px] font-medium text-emerald-300/90">{promoHint}</p>
                )}
              </div>
            )}
            {stripeReady && payments?.tips?.enabled && !isDowngradeIntent && (
              <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-[var(--muted)]">
                Checkout may show an optional{" "}
                <strong className="text-[var(--text)]">tip for Coach Jeremy</strong> (you can set
                quantity to 0 to skip). More tip amounts anytime under{" "}
                <Link href="/member/account#tip-coach" className="text-accent hover:underline">
                  Account → Tip Coach
                </Link>
                .
              </p>
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
                          : payCta}
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
                {payments?.stripeConfigured
                  ? "This plan is not ready for checkout yet. Message coach Jeremy."
                  : "Online checkout is not configured yet. Contact Jeremy to complete signup."}
              </p>
            )}
            {!paymentsLoading && !stripeReady && venmoReady ? (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-100/95">
                Pay with <strong className="text-[var(--text)]">Venmo to Coach Jeremy</strong> — same
                Train Station business. Card checkout is paused until our processor shows The Train
                Station name (not a third-party brand).
              </p>
            ) : null}
            {venmoReady && payments?.venmo && (
              <div className="space-y-3 rounded-xl border border-accent/30 bg-[var(--surface-2)] p-4">
                <p className="text-center text-xs font-semibold uppercase tracking-[2px] text-accent">
                  {stripeReady ? "Or pay with Venmo" : "Pay with Venmo"}
                </p>
                <p className="text-center text-[11px] text-[var(--muted)]">
                  {stripeReady
                    ? "Same Train Station business bank account as card deposits — pick card or Venmo."
                    : "Scan Jeremy’s business Venmo. Include your full name in the note. He unlocks your ticket in the app after it posts."}
                </p>
                {payments.venmo.handle && (
                  <p className="text-center text-lg font-semibold tracking-wide">
                    {payments.venmo.handle}
                  </p>
                )}
                <div className="mx-auto max-w-[200px] overflow-hidden rounded-lg bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payments.venmo.qrUrl!} alt="Venmo QR code" className="h-auto w-full" />
                </div>
                <p className="text-center text-xs text-[var(--muted)]">
                  {payments.venmo.instructions ||
                    "Scan to pay and include your full name in the note. Coach marks you paid in Admin → Members after the payment posts."}
                </p>
              </div>
            )}
            {isSignupCheckout && isMembershipPlan(plan) && upgradePlans.length > 0 && (
              <CheckoutUpgradeOptions
                currentPlan={plan}
                upgradePlans={upgradePlans}
                memberships={payments?.memberships}
              />
            )}
            <div className="flex flex-col items-center gap-2 text-xs text-[var(--muted)]">
              {isDowngradeIntent ? (
                <Link href="/member/account" className="hover:text-accent">
                  Cancel — keep current plan
                </Link>
              ) : (
                <>
                  {/* Stay inside the member app — no landing / join escapes while signed in. */}
                  <Link href="/member/account" className="hover:text-accent">
                    Account &amp; billing
                  </Link>
                  <Link href="/member/chat" className="hover:text-accent">
                    Message coach
                  </Link>
                </>
              )}
            </div>
          </MembershipPaymentCard>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                You&apos;re signed in · Free Explorer
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Same seats as the landing page. Tap a paid ticket for card or Venmo checkout —
                or stay free for now.
              </p>
              {error ? <p className="mt-2 text-sm text-amber-400">{error}</p> : null}
            </div>
            {paymentsLoading ? (
              <p className="text-center text-sm text-[var(--muted)]">Loading tickets…</p>
            ) : (
              <MembershipTicketGrid
                mode="checkout"
                promoCode={promoCode}
                showBrand
                heading="Membership tickets"
                subheading="Tap a ticket — same train seats as home. We'll take you to pay (or Today if you stay free)."
              />
            )}
            <p className="text-center text-[11px] text-[var(--muted)]">
              <Link href="/member/today" className="font-semibold text-accent hover:underline">
                Open free dashboard
              </Link>
              {" · "}
              <Link href="/member/account" className="hover:text-accent">
                Account
              </Link>
            </p>
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