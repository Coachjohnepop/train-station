"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

type Props = {
  open: boolean;
  publishableKey: string;
  clientSecret: string | null;
  sessionId: string | null;
  onClose: () => void;
  onComplete: (sessionId: string) => void;
};

export default function EmbeddedStripeCheckoutModal({
  open,
  publishableKey,
  clientSecret,
  sessionId,
  onClose,
  onComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [mounting, setMounting] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!open || !clientSecret || !publishableKey) return;

    let destroyed = false;
    setMounting(true);
    setMountError(null);

    (async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe || destroyed) return;

        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => {
            if (sessionId) onCompleteRef.current(sessionId);
          },
        });

        if (destroyed) {
          checkout.destroy();
          return;
        }

        checkoutRef.current = checkout;
        if (containerRef.current) {
          checkout.mount(containerRef.current);
        }
      } catch (e: unknown) {
        if (!destroyed) {
          setMountError(e instanceof Error ? e.message : "Could not load secure checkout.");
        }
      } finally {
        if (!destroyed) setMounting(false);
      }
    })();

    return () => {
      destroyed = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [open, clientSecret, publishableKey, sessionId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-checkout-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(78vh,640px)] w-full max-w-[min(100%,22rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Secure checkout</p>
            <h2 id="stripe-checkout-title" className="text-sm font-semibold">
              Complete payment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Close checkout"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {mounting && (
            <p className="py-6 text-center text-xs text-[var(--muted)]">Loading payment form…</p>
          )}
          {mountError && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {mountError}
            </p>
          )}
          <div ref={containerRef} className="min-h-[300px] sm:min-h-[340px]" />
        </div>
      </div>
    </div>
  );
}