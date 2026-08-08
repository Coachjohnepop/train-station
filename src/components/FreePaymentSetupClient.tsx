"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EmbeddedStripeCheckoutModal from "@/components/EmbeddedStripeCheckoutModal";

/**
 * Free Explorer — save a card ($0). Copy promises no charge until upgrade.
 */
export default function FreePaymentSetupClient({ canceled }: { canceled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const startSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.redirectTo) {
          window.location.replace(data.redirectTo);
          return;
        }
        throw new Error(data.error || "Could not start card setup.");
      }
      if (data.alreadyOnFile && data.redirectTo) {
        window.location.replace(data.redirectTo);
        return;
      }
      if (!data.clientSecret || !data.publishableKey) {
        throw new Error("Stripe setup response incomplete.");
      }
      setClientSecret(data.clientSecret);
      setSessionId(data.sessionId);
      setPublishableKey(data.publishableKey);
      setModalOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void startSetup();
  }, [startSetup]);

  async function onComplete(sid: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not confirm card.");
      window.location.replace(data.redirectTo || "/member/onboard?plan=explorer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Confirm failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
        Free Explorer · card on file
      </p>
      <h1 className="text-2xl font-bold text-[var(--text)]">Add a card to board Free</h1>
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        We <strong className="text-[var(--text)]">will not charge you</strong> for Free Explorer.
        Saving a card makes upgrading to Coach Class one step later. You can remove it anytime in
        Account after setup.
      </p>
      {canceled ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          Setup canceled — Free stays locked until a card is on file (when this requirement is on).
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={loading}
        onClick={() => void startSetup()}
      >
        {loading ? "Opening secure form…" : "Save card (no charge)"}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">
        <Link href="/member/chat" className="underline">
          Message coach
        </Link>
        {" · "}
        <Link href="/member/account" className="underline">
          Account
        </Link>
      </p>

      {publishableKey ? (
        <EmbeddedStripeCheckoutModal
          open={modalOpen}
          publishableKey={publishableKey}
          clientSecret={clientSecret}
          sessionId={sessionId}
          onClose={() => setModalOpen(false)}
          onComplete={(id) => void onComplete(id)}
        />
      ) : null}
    </div>
  );
}
