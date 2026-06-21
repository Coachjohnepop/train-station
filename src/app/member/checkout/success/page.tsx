"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function CheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [message, setMessage] = useState("Confirming payment…");

  useEffect(() => {
    if (!sessionId) {
      setMessage("Missing checkout session. Return to checkout and try again.");
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      setMessage(data.error || "Payment confirmation failed. Contact support if you were charged.");
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 text-center">
      <div className="card p-6">
        <p className="text-sm text-[var(--muted)]">{message}</p>
      </div>
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