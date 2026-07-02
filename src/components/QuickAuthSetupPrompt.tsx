"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import PinPad from "@/components/PinPad";
import {
  clearQuickAuthSetupSkipped,
  platformAuthenticatorAvailable,
  useQuickAuthDeviceId,
  writeQuickAuthMeta,
} from "@/lib/quick-auth-client";

const PIN_LENGTH = 4;

type QuickAuthSetupPromptProps = {
  email: string;
  onContinue: () => void;
};

export default function QuickAuthSetupPrompt({
  email,
  onContinue,
}: QuickAuthSetupPromptProps) {
  const { deviceId, ready } = useQuickAuthDeviceId();
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [draftPin, setDraftPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [webauthnEnabled, setWebauthnEnabled] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!ready) return;
    const res = await fetch("/api/auth/quick-auth/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, deviceId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { pin?: boolean; webauthn?: boolean };
    const pin = Boolean(data.pin);
    const webauthn = Boolean(data.webauthn);
    setPinEnabled(pin);
    setWebauthnEnabled(webauthn);
    writeQuickAuthMeta({
      email: email.trim().toLowerCase(),
      pin,
      webauthn,
      updatedAt: new Date().toISOString(),
    });
  }, [ready, email, deviceId]);

  useEffect(() => {
    if (!ready) return;
    void refreshStatus();
    void platformAuthenticatorAvailable().then(setBiometricReady);
  }, [ready, refreshStatus]);

  const savePin = useCallback(
    async (first: string, second: string) => {
      if (!ready) return;
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

        setPinEnabled(true);
        setEditingPin(false);
        setDraftPin("");
        setConfirmPin("");
        setPinStep("enter");
        clearQuickAuthSetupSkipped();
        writeQuickAuthMeta({
          email: email.trim().toLowerCase(),
          pin: true,
          webauthn: webauthnEnabled,
          updatedAt: new Date().toISOString(),
        });
        setMessage(
          editingPin
            ? "PIN updated — use your new code next time you sign in."
            : "PIN saved — quick sign-in is ready on this device.",
        );
        await refreshStatus();
      } catch {
        setError("Could not save PIN.");
        setDraftPin("");
        setConfirmPin("");
        setPinStep("enter");
      } finally {
        setBusy(false);
      }
    },
    [ready, deviceId, email, webauthnEnabled, editingPin, refreshStatus],
  );

  const removePin = useCallback(async () => {
    if (!ready) return;
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove PIN.");
        return;
      }
      setPinEnabled(false);
      setEditingPin(false);
      setDraftPin("");
      setConfirmPin("");
      setPinStep("enter");
      writeQuickAuthMeta({
        email: email.trim().toLowerCase(),
        pin: false,
        webauthn: webauthnEnabled,
        updatedAt: new Date().toISOString(),
      });
      setMessage("PIN removed from this account on this device.");
      await refreshStatus();
    } catch {
      setError("Could not remove PIN.");
    } finally {
      setBusy(false);
    }
  }, [ready, deviceId, email, webauthnEnabled, refreshStatus]);

  function startChangePin() {
    setError("");
    setMessage("");
    setDraftPin("");
    setConfirmPin("");
    setPinStep("enter");
    setEditingPin(true);
  }

  function cancelChangePin() {
    setEditingPin(false);
    setDraftPin("");
    setConfirmPin("");
    setPinStep("enter");
    setError("");
  }

  useEffect(() => {
    if (pinStep !== "enter" || draftPin.length !== PIN_LENGTH || busy) return;
    setPinStep("confirm");
    setConfirmPin("");
  }, [draftPin, pinStep, busy]);

  useEffect(() => {
    if (pinStep !== "confirm" || confirmPin.length !== PIN_LENGTH || busy) return;
    void savePin(draftPin, confirmPin);
  }, [confirmPin, pinStep, busy, draftPin, savePin]);

  async function registerBiometrics() {
    if (!ready) return;
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
      setMessage("Face ID / Touch ID enabled.");
      setWebauthnEnabled(true);
      await refreshStatus();
    } catch {
      setError("Biometric setup cancelled or failed.");
    } finally {
      setBusy(false);
    }
  }

  const quickAuthReady = pinEnabled || webauthnEnabled;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Lock your phone for faster sign-in</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Set a PIN or Face ID / Touch ID so you don&apos;t have to type your password every time you
          open the app — including private browsing on this device.
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

      {pinEnabled && !editingPin ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
          <p className="text-sm text-emerald-100">PIN is enabled on this device.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy || !ready}
              onClick={startChangePin}
            >
              Change PIN
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={busy || !ready}
              onClick={() => void removePin()}
            >
              Remove PIN
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-xs text-[var(--muted)]">
            {editingPin
              ? pinStep === "enter"
                ? "Enter a new 4-digit PIN"
                : "Confirm your new PIN"
              : pinStep === "enter"
                ? "Choose a 4-digit PIN"
                : "Confirm your PIN"}
          </p>
          <PinPad
            value={pinStep === "enter" ? draftPin : confirmPin}
            onChange={pinStep === "enter" ? setDraftPin : setConfirmPin}
            maxLength={PIN_LENGTH}
            disabled={busy || !ready}
          />
          {editingPin && (
            <button
              type="button"
              className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              disabled={busy}
              onClick={cancelChangePin}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {biometricReady && !webauthnEnabled && (
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={busy || !ready}
          onClick={() => void registerBiometrics()}
        >
          {busy ? "Setting up…" : "Enable Face ID / Touch ID"}
        </button>
      )}

      {webauthnEnabled && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-emerald-100">
          Biometrics enabled on this device.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onContinue} className="btn-ghost flex-1" disabled={busy}>
          {quickAuthReady ? "Continue setup" : "Skip for now"}
        </button>
        {quickAuthReady && (
          <button type="button" onClick={onContinue} className="btn-primary flex-1" disabled={busy}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}