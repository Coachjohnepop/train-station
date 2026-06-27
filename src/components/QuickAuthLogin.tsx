"use client";

import { useCallback, useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import PinPad from "@/components/PinPad";
import {
  clearQuickAuthMeta,
  platformAuthenticatorAvailable,
  useQuickAuthDeviceId,
  writeQuickAuthMeta,
} from "@/lib/quick-auth-client";

type QuickAuthLoginProps = {
  email: string;
  redirect: string;
  onUsePassword: () => void;
  onAvailabilityChange?: (enabled: boolean) => void;
  onStatusResolved?: (enabled: boolean) => void;
};

export default function QuickAuthLogin({
  email,
  redirect,
  onUsePassword,
  onAvailabilityChange,
  onStatusResolved,
}: QuickAuthLoginProps) {
  const { deviceId, ready } = useQuickAuthDeviceId();
  const [pin, setPin] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [webauthnEnabled, setWebauthnEnabled] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusResolved, setStatusResolved] = useState(false);
  const PIN_SUBMIT_DELAY_MS = 500;

  const signInWithBiometrics = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/quick-auth/webauthn/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, deviceId }),
      });
      const options = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok) {
        setError(options.error || "Biometrics unavailable.");
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/quick-auth/webauthn/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, deviceId, assertion, redirect }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setError(data.error || "Biometric sign-in failed.");
        return;
      }
      window.location.href = data.redirect || "/member";
    } catch {
      setError("Biometric sign-in cancelled or failed.");
    } finally {
      setLoading(false);
    }
  }, [ready, email, deviceId, redirect]);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (!ready || pinValue.length < 4) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/quick-auth/pin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, pin: pinValue, deviceId, redirect }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Incorrect PIN.");
          setPin("");
          return;
        }
        window.location.href = data.redirect || "/member";
      } catch {
        setError("Sign-in failed — try again.");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [ready, email, deviceId, redirect],
  );

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    setStatusResolved(false);
    setPinEnabled(false);
    setWebauthnEnabled(false);
    setError(null);
    setPin("");

    void platformAuthenticatorAvailable().then((ok) => {
      if (!cancelled) setBiometricReady(ok);
    });

    void fetch("/api/auth/quick-auth/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, deviceId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pin?: boolean; webauthn?: boolean; enabled?: boolean } | null) => {
        if (cancelled) return;
        const enabled = Boolean(data?.enabled);
        onAvailabilityChange?.(enabled);
        onStatusResolved?.(enabled);
        setStatusResolved(true);
        if (!enabled) {
          clearQuickAuthMeta();
          return;
        }
        setPinEnabled(Boolean(data?.pin));
        setWebauthnEnabled(Boolean(data?.webauthn));
        writeQuickAuthMeta({
          email: email.trim().toLowerCase(),
          pin: Boolean(data?.pin),
          webauthn: Boolean(data?.webauthn),
          updatedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        if (cancelled) return;
        onAvailabilityChange?.(false);
        onStatusResolved?.(false);
        setStatusResolved(true);
        clearQuickAuthMeta();
      });

    return () => {
      cancelled = true;
    };
  }, [email, deviceId, ready, onAvailabilityChange, onStatusResolved]);

  useEffect(() => {
    if (!pinEnabled || pin.length < 4 || loading || !ready) return;

    const timer = window.setTimeout(() => {
      void submitPin(pin);
    }, PIN_SUBMIT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [pin, pinEnabled, loading, ready, submitPin]);

  if (!ready || !statusResolved || (!pinEnabled && !webauthnEnabled)) return null;

  return (
    <div className="card space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Quick sign-in</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {email.trim().toLowerCase()}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {pinEnabled && (
        <>
          <PinPad value={pin} onChange={setPin} disabled={loading} />
          <p className="text-center text-[10px] text-[var(--muted)]">
            Enter your 4–6 digit PIN — we&apos;ll verify after you pause typing.
          </p>
        </>
      )}

      {webauthnEnabled && biometricReady && (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={loading}
          onClick={() => void signInWithBiometrics()}
        >
          {loading ? "Verifying…" : "Sign in with Face ID / Touch ID"}
        </button>
      )}

      <button
        type="button"
        className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        onClick={onUsePassword}
      >
        Use password instead
      </button>
    </div>
  );
}