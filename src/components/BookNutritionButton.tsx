"use client";

import { useEffect, useState } from "react";
import EmbeddedCalendlyModal from "@/components/EmbeddedCalendlyModal";
import { COACH_CALENDLY_URL } from "@/lib/brand";

export default function BookNutritionButton({
  calendlyUrl,
  cta,
}: {
  calendlyUrl: string | null;
  cta: string;
}) {
  const [open, setOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  const [prefill, setPrefill] = useState<{ email?: string; name?: string }>({});
  const url = calendlyUrl?.trim() || COACH_CALENDLY_URL;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.signedIn || !data.user) return;
        setPrefill({
          email: data.user.email || undefined,
          name: data.user.name || undefined,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (booked) {
    return (
      <p className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
        Nutrition appointment booked — check your email for confirmation.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary inline-flex min-h-11 items-center px-4 text-sm"
        onClick={() => setOpen(true)}
      >
        {cta}
      </button>
      <EmbeddedCalendlyModal
        open={open}
        calendlyUrl={url}
        prefill={prefill}
        title="Book a nutrition appointment"
        onClose={() => setOpen(false)}
        onScheduled={() => setBooked(true)}
      />
    </>
  );
}
