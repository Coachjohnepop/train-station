"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PaymentReceiptCard, {
  type PaymentReceiptView,
} from "@/components/PaymentReceiptCard";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import { isYoutubeUrl } from "@/lib/youtube";

type Phase = "confirming" | "ready" | "error";

function CheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || searchParams.get("sessionId");
  const [phase, setPhase] = useState<Phase>("confirming");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceiptView | null>(null);
  const [continueHref, setContinueHref] = useState("/member/onboard");
  const [step, setStep] = useState<1 | 2>(1);
  const [thankYouVideo, setThankYouVideo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/landing-media", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const url =
          typeof data?.purchaseThankYouVideoUrl === "string"
            ? data.purchaseThankYouVideoUrl.trim()
            : "";
        if (url && isYoutubeUrl(url)) setThankYouVideo(url);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setPhase("error");
      setError("Missing checkout session. Return to checkout and try again.");
      return;
    }

    let cancelled = false;
    (async () => {
      // 1) Confirm payment (marks paid, sets cookies) — stay on this page after.
      const confirmRes = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));
      if (cancelled) return;

      if (!confirmRes.ok) {
        setPhase("error");
        setError(
          confirmData.error ||
            "Payment confirmation failed. Contact support if you were charged.",
        );
        return;
      }

      if (typeof confirmData.redirectTo === "string" && confirmData.redirectTo) {
        setContinueHref(confirmData.redirectTo);
      }

      // 2) Load receipt details for a real confirmation screen.
      const receiptRes = await fetch(
        `/api/stripe/receipt?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" },
      );
      const receiptData = await receiptRes.json().catch(() => ({}));
      if (cancelled) return;

      if (receiptRes.ok && receiptData.receipt) {
        setReceipt(receiptData.receipt);
        if (receiptData.receipt.nextPath) {
          setContinueHref(receiptData.receipt.nextPath);
        }
      } else {
        // Confirm worked; still show a minimal success without full receipt.
        setReceipt({
          sessionId,
          amountTotalLabel: null,
          planLabel: null,
          productName: "Membership",
          paidAt: new Date().toISOString(),
          customerEmail: null,
          cardBrand: null,
          cardLast4: null,
          paymentStatus: "paid",
          receiptUrl: null,
        });
      }
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (phase === "confirming") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 text-center">
        <div className="card space-y-3 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Step 1 of 2
          </p>
          <h1 className="text-xl font-semibold">Confirming your payment…</h1>
          <p className="text-sm text-[var(--muted)]">
            Hang tight — we&apos;re verifying with Stripe. This screen stays until you continue.
          </p>
          <div className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 text-center">
        <div className="card space-y-4 p-6">
          <h1 className="text-xl font-semibold text-amber-200">Could not confirm</h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <div className="flex flex-col gap-2">
            <Link href="/member/checkout" className="btn-primary text-sm">
              Back to checkout
            </Link>
            <Link href="/member/account" className="btn-ghost text-sm">
              Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      {step === 1 && receipt ? (
        <div className="space-y-4">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Step 2 of 2 · Confirmation
          </p>
          {thankYouVideo ? (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <p className="bg-[var(--surface-2)] px-3 py-2 text-center text-xs font-semibold text-[var(--text)]">
                Thank you for the purchase
              </p>
              <YoutubeAutoplayFrame
                className="aspect-video w-full"
                videoUrl={thankYouVideo}
                title="Thank you for your purchase"
              />
            </div>
          ) : null}
          <PaymentReceiptCard receipt={receipt} />
          <button
            type="button"
            className="btn-primary w-full text-sm"
            onClick={() => setStep(2)}
          >
            Next — what happens now
          </button>
          <p className="text-center text-[11px] text-[var(--muted)]">
            You can reopen this anytime under{" "}
            <Link href="/member/account#payment-confirmation" className="text-accent hover:underline">
              Account → Payment confirmation
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="card space-y-5 p-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            You&apos;re in
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Next: finish setup</h1>
          <p className="text-sm text-[var(--muted)]">
            Your payment is recorded. Continue to onboarding so we can line up your program and
            coach access. You can always return to Account for this receipt.
          </p>
          <div className="flex flex-col gap-2">
            <Link href={continueHref} className="btn-primary w-full text-sm">
              Continue to onboarding
            </Link>
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              onClick={() => setStep(1)}
            >
              ← Back to confirmation
            </button>
            <Link
              href="/member/account#payment-confirmation"
              className="text-xs text-[var(--muted)] hover:text-accent"
            >
              View payment confirmation later
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md p-6 text-center text-sm text-[var(--muted)]">
          Confirming payment…
        </div>
      }
    >
      <CheckoutSuccessInner />
    </Suspense>
  );
}
