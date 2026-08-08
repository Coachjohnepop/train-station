"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CompleteInner() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing setup session.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/setup/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Confirm failed");
        if (!cancelled) {
          window.location.replace(data.redirectTo || "/member/onboard?plan=explorer");
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Confirm failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-12 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
        <Link href="/member/payment-setup" className="btn-primary inline-flex">
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center text-sm text-[var(--muted)]">
      Saving card on file… (no charge)
    </div>
  );
}

export default function FreePaymentSetupCompletePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--muted)]">…</div>}>
      <CompleteInner />
    </Suspense>
  );
}
