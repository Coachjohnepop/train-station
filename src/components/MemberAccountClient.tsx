"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MembershipSeatArt from "@/components/MembershipSeatArt";
import CoachTipPanel from "@/components/CoachTipPanel";
import { paymentBillingSummary, seatArtForPlan } from "@/lib/membership-theme";
import type { SignupPlan } from "@/lib/signup-plans";
import { signupPlanLabel } from "@/lib/signup-plans";
import QuickAuthSettings from "@/components/QuickAuthSettings";
import PushAlertSettings from "@/components/PushAlertSettings";
import PaymentReceiptCard, {
  type PaymentReceiptView,
} from "@/components/PaymentReceiptCard";

type MembershipData = {
  plan: string;
  planLabel: string;
  priceDisplay: string | null;
  checkoutMode: string | null;
  paymentStatus: string;
  statusLabel: string;
  paymentMethod: string | null;
  paidAt: string | null;
  approvalStatus: string;
  referralCode: string | null;
  canManageBilling: boolean;
  canCompleteCheckout: boolean;
  hasSavedPaymentMethod: boolean;
  switchablePlans: SignupPlan[];
  upgradePlans?: SignupPlan[];
  downgradePlans?: SignupPlan[];
  intensive: {
    sessionsTotal: number | null;
    sessionsRemaining: number | null;
    expiresAt: string | null;
  } | null;
};

export default function MemberAccountClient({
  membership,
  email,
}: {
  membership: MembershipData;
  email: string;
}) {
  const searchParams = useSearchParams();
  const justTipped = searchParams.get("tipped") === "1";
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceiptView | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [downgradeTarget, setDowngradeTarget] = useState<SignupPlan | null>(null);

  const upgradePlans = membership.upgradePlans ?? membership.switchablePlans ?? [];
  const downgradePlans = membership.downgradePlans ?? [];

  useEffect(() => {
    if (membership.paymentStatus !== "paid" && membership.paymentMethod !== "stripe") {
      return;
    }
    let cancelled = false;
    setReceiptLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/stripe/receipt", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body.receipt) {
          setReceipt(body.receipt);
          setReceiptError("");
        } else {
          setReceipt(null);
          setReceiptError(
            typeof body.error === "string" ? body.error : "No card receipt on file yet.",
          );
        }
      } catch {
        if (!cancelled) setReceiptError("Could not load payment confirmation.");
      } finally {
        if (!cancelled) setReceiptLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [membership.paymentStatus, membership.paymentMethod]);

  // Deep-link: /member/account#payment-confirmation opens the receipt.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#payment-confirmation") {
      setReceiptOpen(true);
    }
  }, []);

  async function openBillingPortal() {
    setBillingBusy(true);
    setBillingError("");
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setBillingError(body.error || "Could not open billing portal.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setBillingError("Could not open billing portal.");
    } finally {
      setBillingBusy(false);
    }
  }

  async function emailPasswordReset() {
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetMsg(body.error || "Could not send reset email.");
      } else {
        setResetMsg(body.message || "Check your email for a reset link.");
      }
    } catch {
      setResetMsg("Could not send reset email.");
    } finally {
      setResetBusy(false);
    }
  }

  function confirmDowngrade() {
    if (!downgradeTarget) return;
    const plan = downgradeTarget;
    setDowngradeTarget(null);
    // Checkout handles plan change; Stripe portal also available for cancel.
    window.location.href = `/member/checkout?plan=${encodeURIComponent(plan)}&intent=downgrade`;
  }

  function cancelDowngrade() {
    setDowngradeTarget(null);
  }

  useEffect(() => {
    if (!downgradeTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDowngradeTarget(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [downgradeTarget]);

  const paidDate = membership.paidAt
    ? new Date(membership.paidAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const intensiveExpiry = membership.intensive?.expiresAt
    ? new Date(membership.intensive.expiresAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const paidPlan = membership.plan !== "explorer";
  const currentPlan = membership.plan as SignupPlan;
  const hasSeatArt = Boolean(seatArtForPlan(currentPlan));

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <div className={`${hasSeatArt ? "card payment-seat-card" : "card"} space-y-3`}>
        {hasSeatArt && (
          <MembershipSeatArt plan={currentPlan} className="w-full" alt={`${membership.planLabel} seating`} />
        )}
        <div className={hasSeatArt ? "payment-seat-card__body space-y-3 !pt-0" : "space-y-3"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Your ticket</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{membership.planLabel}</h2>
                <span className="badge-accent inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight">
                  Current
                </span>
              </div>
              {membership.priceDisplay && (
                <p className="mt-1 text-sm text-[var(--muted)]">{membership.priceDisplay}</p>
              )}
              {paidPlan && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {paymentBillingSummary(currentPlan, membership.priceDisplay)}
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                membership.paymentStatus === "paid"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : membership.paymentStatus === "pending"
                    ? "bg-amber-500/15 text-amber-200"
                    : "bg-[var(--surface-2)] text-[var(--muted)]"
              }`}
            >
              {membership.statusLabel}
            </span>
          </div>

          {paidDate && (
            <p className="text-sm text-[var(--muted)]">
              Member since {paidDate}
              {membership.paymentMethod ? ` · Paid via ${membership.paymentMethod}` : ""}
            </p>
          )}

          {membership.approvalStatus === "pending" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Coach approval is still pending — you&apos;ll get full access once Jeremy approves your
              account.
            </p>
          )}

          {membership.intensive && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
              <p className="font-medium">1-on-1 package</p>
              <p className="mt-1 text-[var(--muted)]">
                {membership.intensive.sessionsRemaining ?? membership.intensive.sessionsTotal} of{" "}
                {membership.intensive.sessionsTotal} sessions remaining
                {intensiveExpiry ? ` · use by ${intensiveExpiry}` : ""}
              </p>
            </div>
          )}

          {membership.referralCode && (
            <p className="text-sm text-[var(--muted)]">
              Your referral code:{" "}
              <code className="rounded bg-black/20 px-1.5 py-0.5 text-[var(--foreground)]">
                {membership.referralCode}
              </code>
            </p>
          )}
        </div>
      </div>

      {/* Tip coach — evergreen primary home (not mid-workout) */}
      <CoachTipPanel justTipped={justTipped} />

      {/* Upgrades only — seat art cards; never show lower tiers here */}
      {upgradePlans.length > 0 && (
        <div className="card space-y-3">
          <div>
            <h3 className="font-semibold">Upgrade your ticket</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Higher classes only — you already have {membership.planLabel}
              {paidPlan ? ", so lower tickets stay hidden." : "."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {upgradePlans.map((switchPlan) => {
              const hasSeat = Boolean(seatArtForPlan(switchPlan));
              return (
                <Link
                  key={switchPlan}
                  href={`/member/checkout?plan=${encodeURIComponent(switchPlan)}`}
                  className="group relative block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] transition hover:border-accent/50"
                >
                  {hasSeat ? (
                    <div className="relative h-40 w-full">
                      <MembershipSeatArt
                        plan={switchPlan}
                        className="!h-full !rounded-none"
                        alt={`${signupPlanLabel(switchPlan)} seating`}
                      />
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3">
                        <p className="text-sm font-bold text-white drop-shadow">
                          {signupPlanLabel(switchPlan)}
                        </p>
                        <p className="text-[11px] font-medium text-white/90">Upgrade →</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <p className="text-sm font-semibold">{signupPlanLabel(switchPlan)}</p>
                      <p className="text-[11px] text-accent">Upgrade →</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Security */}
      <div className="card space-y-3">
        <h3 className="font-semibold">Security</h3>
        <p className="text-xs text-[var(--muted)]">Signed in as {email}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={resetBusy}
            onClick={() => void emailPasswordReset()}
          >
            {resetBusy ? "Sending…" : "Email password reset"}
          </button>
          <Link href="/forgot-password" className="btn-ghost text-xs">
            Reset password page
          </Link>
        </div>
        {resetMsg && <p className="text-xs text-[var(--muted)]">{resetMsg}</p>}
        <div className="border-t border-[var(--border)] pt-3">
          <QuickAuthSettings email={email} />
        </div>
      </div>

      {/* Notifications — phone / home-screen only (hidden on desktop browser) */}
      <div className="card space-y-2 hidden max-[899px]:block">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <p className="text-[11px] text-[var(--muted)]">
          Phone banners and home-screen badge. Turn off anytime here.
        </p>
        <PushAlertSettings />
      </div>

      {/* Membership manage — billing + downgrade with confirm */}
      <div className="card space-y-3">
        <h3 className="font-semibold">Membership</h3>

        {membership.hasSavedPaymentMethod && (
          <p className="text-sm text-[var(--muted)]">
            A payment method is saved securely with Stripe for faster checkout — card numbers never
            touch our servers.
          </p>
        )}

        {membership.canCompleteCheckout && (
          <Link
            href={`/member/checkout?plan=${encodeURIComponent(membership.plan)}`}
            className="btn-primary inline-block text-sm"
          >
            Complete checkout
          </Link>
        )}

        {/* Payment confirmation — reopen anytime after card checkout */}
        <div
          id="payment-confirmation"
          className="space-y-2 scroll-mt-24 border-t border-[var(--border)] pt-3"
        >
          <p className="text-sm font-medium">Payment confirmation</p>
          {receiptLoading ? (
            <p className="text-xs text-[var(--muted)]">Loading receipt…</p>
          ) : receipt ? (
            <>
              <p className="text-xs text-[var(--muted)]">
                {receipt.amountTotalLabel || "Paid"}
                {receipt.planLabel ? ` · ${receipt.planLabel}` : ""}
                {receipt.paidAt
                  ? ` · ${new Date(receipt.paidAt).toLocaleDateString()}`
                  : ""}
              </p>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setReceiptOpen((o) => !o)}
              >
                {receiptOpen ? "Hide confirmation" : "View payment confirmation"}
              </button>
              {receiptOpen ? (
                <div className="pt-2">
                  <PaymentReceiptCard receipt={receipt} />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              {receiptError ||
                "Card payment confirmations show here after Stripe checkout. Venmo members are marked paid by coach."}
            </p>
          )}
        </div>

        {membership.canManageBilling && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Update your card, view invoices, or cancel in Stripe&apos;s secure billing portal.
            </p>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={billingBusy}
              onClick={() => void openBillingPortal()}
            >
              {billingBusy ? "Opening…" : "Manage billing"}
            </button>
            {billingError && <p className="text-sm text-red-300">{billingError}</p>}
          </div>
        )}

        {downgradePlans.length > 0 && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm font-medium text-[var(--text)]">Change to a lower ticket</p>
            <p className="text-xs text-[var(--muted)]">
              Downgrades only live here (not on upgrade cards). We&apos;ll ask you to confirm first.
            </p>
            <div className="flex flex-wrap gap-2">
              {downgradePlans.map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className="btn-ghost text-xs border border-[var(--border)]"
                  onClick={() => setDowngradeTarget(plan)}
                >
                  Switch to {signupPlanLabel(plan)}
                </button>
              ))}
            </div>
          </div>
        )}

        {membership.paymentStatus === "paid" &&
          !membership.canManageBilling &&
          membership.checkoutMode === "one_time" && (
            <p className="text-sm text-[var(--muted)]">
              Your 1st Class package is a one-time purchase. For billing questions, message your
              coach.
            </p>
          )}

        {!membership.canCompleteCheckout &&
          !membership.canManageBilling &&
          membership.plan !== "explorer" &&
          membership.paymentStatus !== "paid" && (
            <p className="text-sm text-[var(--muted)]">
              Need help with your plan? Message your coach from{" "}
              <Link href="/member/chat" className="text-accent hover:underline">
                Messages
              </Link>
              .
            </p>
          )}
      </div>

      {/* Downgrade confirm modal */}
      {downgradeTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="downgrade-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDowngrade();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-5 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">
              Confirm downgrade
            </p>
            <h2 id="downgrade-title" className="mt-1 text-lg font-semibold text-[var(--text)]">
              Switch to {signupPlanLabel(downgradeTarget)}?
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
              <li>
                You&apos;re on{" "}
                <strong className="text-[var(--text)]">{membership.planLabel}</strong> now.
              </li>
              <li>Lower tickets can remove perks that came with your current seat.</li>
              <li>
                To go back up later, use <strong className="text-[var(--text)]">Upgrade</strong> on
                this Account page (or checkout).
              </li>
              {membership.canManageBilling && (
                <li>
                  Prefer to cancel entirely? Use{" "}
                  <strong className="text-[var(--text)]">Manage billing</strong> instead — no plan
                  switch.
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Next step opens checkout for {signupPlanLabel(downgradeTarget)}. You can still back out
              there.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-ghost px-4 py-2 text-sm"
                onClick={cancelDowngrade}
              >
                Keep {membership.planLabel}
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                onClick={confirmDowngrade}
              >
                Yes, switch to {signupPlanLabel(downgradeTarget)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
