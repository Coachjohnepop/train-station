"use client";

import Link from "next/link";

export type PaymentReceiptView = {
  sessionId: string;
  amountTotalLabel: string | null;
  planLabel: string | null;
  productName: string | null;
  paidAt: string | null;
  customerEmail: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  paymentStatus: string;
  receiptUrl: string | null;
  nextPath?: string;
  fulfillmentLabel?: string | null;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function PaymentReceiptCard({
  receipt,
  continueHref,
  continueLabel = "Continue",
  showContinue = false,
}: {
  receipt: PaymentReceiptView;
  continueHref?: string;
  continueLabel?: string;
  showContinue?: boolean;
}) {
  const card =
    receipt.cardLast4
      ? `${receipt.cardBrand ? receipt.cardBrand.toUpperCase() : "Card"} ···· ${receipt.cardLast4}`
      : "Stripe";

  return (
    <div className="card space-y-5 p-6 text-left">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
          Payment confirmed
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Save this confirmation — you can open it anytime under Account.
        </p>
      </div>

      <dl className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Ticket</dt>
          <dd className="font-semibold text-right">
            {receipt.planLabel || receipt.productName || "Membership"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Amount paid</dt>
          <dd className="font-semibold text-right text-emerald-300">
            {receipt.amountTotalLabel || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">When</dt>
          <dd className="text-right">{formatWhen(receipt.paidAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Payment</dt>
          <dd className="text-right">{card}</dd>
        </div>
        {receipt.fulfillmentLabel ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Pickup</dt>
            <dd className="text-right">{receipt.fulfillmentLabel}</dd>
          </div>
        ) : null}
        {receipt.customerEmail ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Email</dt>
            <dd className="text-right text-xs break-all">{receipt.customerEmail}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2">
          <dt className="text-[var(--muted)]">Reference</dt>
          <dd className="font-mono text-[10px] text-right break-all text-[var(--muted)]">
            {receipt.sessionId}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Status</dt>
          <dd className="text-right capitalize text-emerald-300">{receipt.paymentStatus}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        {receipt.receiptUrl ? (
          <a
            href={receipt.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary w-full text-center text-sm"
          >
            Open Stripe receipt ↗
          </a>
        ) : null}
        {showContinue && continueHref ? (
          <Link href={continueHref} className="btn-primary w-full text-center text-sm">
            {continueLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
