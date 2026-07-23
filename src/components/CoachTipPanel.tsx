"use client";

import { useCallback, useEffect, useState } from "react";
import EmbeddedStripeCheckoutModal from "@/components/EmbeddedStripeCheckoutModal";
import {
  TIP_CUSTOM_MAX_DOLLARS,
  TIP_CUSTOM_MIN_DOLLARS,
  TIP_PRESET_DOLLARS,
  type PublicTipConfig,
  formatTipDollars,
} from "@/lib/coach-tips";

type Props = {
  /** Compact for chat footer; full card for Account. */
  variant?: "card" | "compact";
  /** Highlight after successful tip redirect. */
  justTipped?: boolean;
  className?: string;
};

const DEFAULT_PRESETS = [...TIP_PRESET_DOLLARS];

export default function CoachTipPanel({
  variant = "card",
  justTipped = false,
  className = "",
}: Props) {
  const [tips, setTips] = useState<PublicTipConfig | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(10);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDollars, setCustomDollars] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(justTipped);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setThanks(justTipped);
  }, [justTipped]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tipRes, payRes] = await Promise.all([
          fetch("/api/stripe/tip"),
          fetch("/api/payments/public"),
        ]);
        const tipBody = await tipRes.json().catch(() => ({}));
        const payBody = await payRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!tipRes.ok) {
          setLoadError(tipBody.error || "Tips unavailable.");
          return;
        }
        const cfg = tipBody.tips as PublicTipConfig | undefined;
        setTips(cfg ?? null);
        setPublishableKey(
          typeof payBody.stripePublishableKey === "string" ? payBody.stripePublishableKey : null,
        );
        if (cfg?.presets?.length) {
          setSelected(cfg.presets.includes(10) ? 10 : cfg.presets[0]);
        } else if (cfg?.customEnabled) {
          setSelected(null);
          setCustomOpen(true);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load tip options.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountDollars = (() => {
    if (customOpen) {
      const n = Math.round(Number(customDollars));
      if (!Number.isFinite(n)) return null;
      return n;
    }
    return selected;
  })();

  const startTip = useCallback(async () => {
    setError(null);
    if (amountDollars == null || amountDollars < TIP_CUSTOM_MIN_DOLLARS) {
      setError(`Enter a tip between $${TIP_CUSTOM_MIN_DOLLARS} and $${TIP_CUSTOM_MAX_DOLLARS}.`);
      return;
    }
    if (amountDollars > TIP_CUSTOM_MAX_DOLLARS) {
      setError(`Max tip is $${TIP_CUSTOM_MAX_DOLLARS}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountDollars }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.clientSecret || !body.sessionId) {
        setError(body.error || "Could not start tip checkout.");
        return;
      }
      setClientSecret(body.clientSecret);
      setSessionId(body.sessionId);
      setCheckoutOpen(true);
    } catch {
      setError("Could not start tip checkout.");
    } finally {
      setBusy(false);
    }
  }, [amountDollars]);

  const onComplete = useCallback((sid: string) => {
    setCheckoutOpen(false);
    setClientSecret(null);
    setSessionId(null);
    window.location.href = `/member/checkout/success?session_id=${encodeURIComponent(sid)}`;
  }, []);

  if (loadError) {
    if (variant === "compact") return null;
    return (
      <div className={`card space-y-2 ${className}`}>
        <h3 className="font-semibold">Tip your coach</h3>
        <p className="text-sm text-[var(--muted)]">{loadError}</p>
      </div>
    );
  }

  if (!tips) {
    if (variant === "compact") return null;
    return (
      <div className={`card space-y-2 ${className}`}>
        <h3 className="font-semibold">Tip your coach</h3>
        <p className="text-sm text-[var(--muted)]">Loading tip options…</p>
      </div>
    );
  }

  if (!tips.enabled) {
    if (variant === "compact") return null;
    return (
      <div id="tip-coach" className={`card space-y-2 ${className}`}>
        <h3 className="font-semibold">Tip your coach</h3>
        <p className="text-sm text-[var(--muted)]">
          Card tips are being set up. Prefer Venmo? Ask Jeremy in Messages — same Train Station
          business account.
        </p>
      </div>
    );
  }

  const presets = tips.presets.length > 0 ? tips.presets : DEFAULT_PRESETS.filter(() => false);
  const showPresets = tips.presets.length > 0;

  const body = (
    <>
      {thanks && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Thank you — Jeremy got your tip. You’re the best.
        </p>
      )}

      <p className={variant === "compact" ? "text-xs text-[var(--muted)]" : "text-sm text-[var(--muted)]"}>
        Optional one-time thanks. Doesn’t change your membership. Goes to Coach Jeremy / The Train
        Station.
      </p>

      {showPresets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((d) => {
            const active = !customOpen && selected === d;
            return (
              <button
                key={d}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-accent bg-accent/20 text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-accent/40"
                }`}
                onClick={() => {
                  setCustomOpen(false);
                  setSelected(d);
                  setError(null);
                }}
              >
                {formatTipDollars(d)}
              </button>
            );
          })}
          {tips.customEnabled && (
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                customOpen
                  ? "border-accent bg-accent/20 text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-accent/40"
              }`}
              onClick={() => {
                setCustomOpen(true);
                setSelected(null);
                setError(null);
              }}
            >
              Custom
            </button>
          )}
        </div>
      )}

      {(customOpen || (!showPresets && tips.customEnabled)) && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--muted)]" htmlFor="tip-custom-dollars">
            Amount ($)
          </label>
          <input
            id="tip-custom-dollars"
            type="number"
            min={tips.minCustomDollars}
            max={tips.maxCustomDollars}
            step={1}
            inputMode="numeric"
            placeholder="15"
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
            value={customDollars}
            onChange={(e) => {
              setCustomDollars(e.target.value);
              setError(null);
            }}
          />
          <span className="text-[11px] text-[var(--muted)]">
            ${tips.minCustomDollars}–${tips.maxCustomDollars}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="button"
        className="btn-primary text-sm"
        disabled={busy || !publishableKey}
        onClick={() => void startTip()}
      >
        {busy
          ? "Opening…"
          : amountDollars
            ? `Tip ${formatTipDollars(amountDollars)} securely`
            : "Choose an amount"}
      </button>

      {!publishableKey && (
        <p className="text-xs text-amber-200">Stripe publishable key missing — tip checkout can’t open.</p>
      )}
    </>
  );

  return (
    <>
      <div
        id="tip-coach"
        className={
          variant === "compact"
            ? `space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 ${className}`
            : `card space-y-3 ${className}`
        }
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            Optional
          </p>
          <h3 className={variant === "compact" ? "text-sm font-semibold" : "font-semibold"}>
            Tip Coach Jeremy
          </h3>
        </div>
        {body}
      </div>

      {publishableKey && (
        <EmbeddedStripeCheckoutModal
          open={checkoutOpen}
          publishableKey={publishableKey}
          clientSecret={clientSecret}
          sessionId={sessionId}
          onClose={() => {
            setCheckoutOpen(false);
            setClientSecret(null);
            setSessionId(null);
          }}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
