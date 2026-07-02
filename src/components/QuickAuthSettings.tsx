"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import PinPad from "@/components/PinPad";
import {
  clearQuickAuthSetupSkipped,
  platformAuthenticatorAvailable,
  useQuickAuthDeviceId,
  writeQuickAuthMeta,
} from "@/lib/quick-auth-client";

type QuickAuthStatus = {
  pin: boolean;
  webauthn: boolean;
};

export default function QuickAuthSettings({ email }: { email: string }) {
  const [status, setStatus] = useState<QuickAuthStatus>({ pin: false, webauthn: false });
  const [biometricReady, setBiometricReady] = useState(false);
  const [pinStep, setPinStep] = useState<"idle" | "enter" | "confirm">("idle");
  const [draftPin, setDraftPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { deviceId, ready } = useQuickAuthDeviceId();

  async function refreshStatus() {
    if (!ready) return;
    const res = await fetch("/api/auth/quick-auth/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, deviceId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as QuickAuthStatus & { enabled?: boolean };
    const next = { pin: Boolean(data.pin), webauthn: Boolean(data.webauthn) };
    setStatus(next);
    writeQuickAuthMeta({
      email: email.trim().toLowerCase(),
      pin: next.pin,
      webauthn: next.webauthn,
      updatedAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    if (!ready) return;
    void refreshStatus();
    void platformAuthenticatorAvailable().then(setBiometricReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, deviceId, ready]);

  useEffect(() => {
    if (pinStep !== "enter" || draftPin.length !== 4 || busy) return;
    setPinStep("confirm");
    setConfirmPin("");
  }, [draftPin, pinStep, busy]);

  useEffect(() => {
    if (pinStep !== "confirm" || confirmPin.length !== 4 || busy) return;
    void savePin(draftPin, confirmPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, pinStep, busy]);

  async function savePin(first: string, second: string) {
    if (first !== second) {
      setError("PINs did not match — try again.");
      setDraftPin("");
      setConfirmPin("");
      setPinStep("enter");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/quick-auth/setup-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pin: first, deviceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save PIN.");
        setDraftPin("");
        setConfirmPin("");
        setPinStep("enter");
        return;
      }
      clearQuickAuthSetupSkipped();
      setMessage(status.pin ? "PIN updated for this device." : "PIN saved for this device.");
      setPinStep("idle");
      setDraftPin("");
      setConfirmPin("");
      await refreshStatus();
    } catch {
      setError("Could not save PIN.");
      setPinStep("idle");
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/quick-auth/remove-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) {
        setError("Could not remove PIN.");
        return;
      }
      setMessage("PIN removed from this device.");
      await refreshStatus();
    } catch {
      setError("Could not remove PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function registerBiometrics() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const optionsRes = await fetch("/api/auth/quick-auth/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId }),
      });
      const options = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok) {
        setError(options.error || "Could not start biometric setup.");
        return;
      }

      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/quick-auth/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId, attestation }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setError(data.error || "Biometric setup failed.");
        return;
      }
      setMessage("Face ID / Touch ID enabled on this device.");
      await refreshStatus();
    } catch {
      setError("Biometric setup cancelled or failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBiometrics() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/quick-auth/remove-webauthn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) {
        setError("Could not remove biometrics.");
        return;
      }
      setMessage("Biometrics removed from this device.");
      await refreshStatus();
    } catch {
      setError("Could not remove biometrics.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold">Quick sign-in</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          After signing in with your password, set a PIN or biometrics on this device for faster
          access next time — including private browsing for the current session.
        </p>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">PIN code</p>
            <p className="text-xs text-[var(--muted)]">
              {status.pin ? "Enabled on this device" : "4 digits, device only"}
            </p>
          </div>
          {status.pin && pinStep === "idle" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setDraftPin("");
                  setConfirmPin("");
                  setPinStep("enter");
                }}
              >
                Change PIN
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy}
                onClick={() => void removePin()}
              >
                Remove
              </button>
            </div>
          ) : pinStep === "idle" ? (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy}
              onClick={() => {
                setError("");
                setMessage("");
                setDraftPin("");
                setConfirmPin("");
                setPinStep("enter");
              }}
            >
              Set up PIN
            </button>
          ) : null}
        </div>

        {pinStep !== "idle" && (
          <div className="space-y-2">
            <p className="text-center text-xs text-[var(--muted)]">
              {status.pin
                ? pinStep === "enter"
                  ? "Enter a new PIN"
                  : "Confirm your new PIN"
                : pinStep === "enter"
                  ? "Choose a PIN"
                  : "Confirm your PIN"}
            </p>
            <PinPad
              value={pinStep === "enter" ? draftPin : confirmPin}
              onChange={pinStep === "enter" ? setDraftPin : setConfirmPin}
              disabled={busy}
            />
            <button
              type="button"
              className="w-full text-center text-xs text-[var(--muted)]"
              onClick={() => {
                setPinStep("idle");
                setDraftPin("");
                setConfirmPin("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {biometricReady && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Face ID / Touch ID</p>
              <p className="text-xs text-[var(--muted)]">
                {status.webauthn ? "Enabled on this device" : "Use your device biometrics"}
              </p>
            </div>
            {status.webauthn ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={busy}
                onClick={() => void removeBiometrics()}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => void registerBiometrics()}
              >
                Enable
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}