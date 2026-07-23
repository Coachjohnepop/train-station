"use client";

/**
 * Buried push-alert controls for Account / Settings.
 * Not a nag banner — only for re-enable, test, or turn off.
 */

import { useEffect, useState } from "react";
import {
  clearPushAlertsPermanentlyEnabled,
  disablePushAlerts,
  enablePushAlerts,
  getPushPermission,
  isMobilePushSurface,
  isPushAlertsPermanentlyEnabled,
  isPushSupported,
  isStandalonePwa,
  markPushAlertsPermanentlyEnabled,
  sendTestPushAlert,
} from "@/lib/push-client";

export default function PushAlertSettings() {
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(
    null,
  );
  const [enabledFlag, setEnabledFlag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Desktop browser: hide phone-alert controls entirely.
    if (!isMobilePushSurface() || !isPushSupported()) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setStandalone(isStandalonePwa());
    setEnabledFlag(isPushAlertsPermanentlyEnabled());
    void getPushPermission().then(setPermission);
  }, []);

  if (!supported) return null;

  async function onEnable() {
    setBusy(true);
    setMessage(null);
    const result = await enablePushAlerts({ forceResubscribe: true });
    setBusy(false);
    if (result.ok) {
      markPushAlertsPermanentlyEnabled();
      setEnabledFlag(true);
      setPermission("granted");
      setStandalone(true);
      setMessage("Phone alerts on.");
    } else {
      setMessage(result.error || "Could not enable.");
    }
  }

  async function onTest() {
    setBusy(true);
    setMessage(null);
    const result = await sendTestPushAlert();
    setBusy(false);
    if (result.ok) {
      setMessage(`Test sent (${result.sent} device). Lock phone to confirm.`);
    } else {
      setMessage(result.error || "Test failed.");
    }
  }

  async function onDisable() {
    setBusy(true);
    setMessage(null);
    await disablePushAlerts();
    clearPushAlertsPermanentlyEnabled();
    setEnabledFlag(false);
    setBusy(false);
    setMessage("Phone alerts off on this device. You can turn them back on here anytime.");
  }

  const on = enabledFlag || permission === "granted";

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div>
        <p className="text-xs font-semibold text-[var(--text)]">Phone alerts &amp; app badge</p>
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
          {!standalone
            ? "Install to Home Screen first (Share → Add to Home Screen), then enable here."
            : on
              ? "Alerts are on for this device. Optional: send a test or turn off."
              : "Get a notification and home-screen badge when you have a new message."}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!on ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEnable()}
            className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {busy ? "…" : "Enable alerts"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onTest()}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text)] hover:bg-amber-500/15 disabled:opacity-60"
            >
              {busy ? "…" : "Send test"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEnable()}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-60"
            >
              Re-bind
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDisable()}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-rose-600 disabled:opacity-60"
            >
              Turn off
            </button>
          </>
        )}
      </div>
      {message && <p className="text-[10px] font-medium text-[var(--text)]">{message}</p>}
    </div>
  );
}
