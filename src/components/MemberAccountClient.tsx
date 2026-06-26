"use client";

import Link from "next/link";
import { useState } from "react";

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
  intensive: {
    sessionsTotal: number | null;
    sessionsRemaining: number | null;
    expiresAt: string | null;
  } | null;
};

export default function MemberAccountClient({ membership }: { membership: MembershipData }) {
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");

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

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Current plan</p>
            <h2 className="text-xl font-semibold">{membership.planLabel}</h2>
            {membership.priceDisplay && (
              <p className="mt-1 text-sm text-[var(--muted)]">{membership.priceDisplay}</p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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

      <div className="card space-y-3">
        <h3 className="font-semibold">Manage membership</h3>

        {membership.canCompleteCheckout && (
          <Link href={`/member/checkout?plan=${encodeURIComponent(membership.plan)}`} className="btn-primary inline-block text-sm">
            Complete checkout
          </Link>
        )}

        {membership.canManageBilling && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Update your card, view invoices, or cancel your subscription in Stripe&apos;s secure
              billing portal.
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

        {membership.plan === "explorer" && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Upgrade to Coach Class, Business Class, or 1st Class from the landing page.
            </p>
            <Link href="/#tickets" className="btn-secondary inline-block text-sm">
              View membership tickets
            </Link>
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
    </div>
  );
}