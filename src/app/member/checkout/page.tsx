"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeSignupPlan, signupPlanLabel } from "@/lib/signup-plans";

function MemberCheckoutInner() {
  const searchParams = useSearchParams();
  const plan = normalizeSignupPlan(searchParams.get("plan") || "member");
  const canceled = searchParams.get("canceled") === "1";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!canceled) void startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-4 p-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[3px] text-accent">
          Secure checkout
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {signupPlanLabel(plan)} membership
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {canceled
            ? "Checkout was canceled. Resume when you are ready — billing is monthly and you can cancel anytime."
            : loading
              ? "Redirecting to Stripe…"
              : "Complete payment to unlock onboarding and your training dashboard."}
        </p>
        {error && <p className="text-sm text-amber-400">{error}</p>}
        <button
          type="button"
          onClick={() => void startCheckout()}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Opening Stripe…" : "Continue to Stripe"}
        </button>
        <Link href="/" className="text-xs text-[var(--muted)] hover:text-accent">
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