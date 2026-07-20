"use client";

/**
 * Enable / re-enable phone notifications + home-screen badge.
 * iPhone: must open Home Screen app (not Safari), then Enable / Send test.
 */

import { useEffect, useState } from "react";
import {
  enablePushAlerts,
  getPushPermission,
  isPushSupported,
  isStandalonePwa,
  sendTestPushAlert,
} from "@/lib/push-client";

const DISMISS_KEY = "ts-push-enable-dismissed";

export default function PushAlertEnable({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(
    null,
  );

  useEffect(() => {
    if (!isPushSupported()) return;
    const installed = isStandalonePwa();
    setStandalone(installed);

    void (async () => {
      const perm = await getPushPermission();
      setPermission(perm);

      // Always show controls when installed but not granted, or not installed.
      // If already granted, show a slim "test / re-enable" strip (iOS often needs re-bind).
      if (perm === "granted" && installed) {
        // Quiet re-sync of SW + subscription
        void enablePushAlerts();
        setVisible(true);
        return;
      }

      try {
        if (window.localStorage.getItem(DISMISS_KEY) === "1" && perm !== "denied") {
          // Still show if not standalone — they need the install tip
          if (installed) return;
        }
      } catch {
        /* ignore */
      }

      if (perm === "denied") {
        setStatus("Notifications blocked in Settings → Train Station.");
      }
      setVisible(true);
    })();
  }, []);

  async function onEnable(force: boolean) {
    setBusy(true);
    setStatus(null);
    const result = await enablePushAlerts({ forceResubscribe: force });
    setBusy(false);
    if (result.ok) {
      setPermission("granted");
      setStandalone(true);
      setStatus("Alerts on. Tap Send test, then lock the phone — you should get a banner.");
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      setStatus(result.error || "Could not enable.");
      if (result.standalone === false) setStandalone(false);
    }
  }

  async function onTest() {
    setBusy(true);
    setStatus(null);
    // Ensure sub is fresh for this login before testing
    const en = await enablePushAlerts({ forceResubscribe: false });
    if (!en.ok) {
      setBusy(false);
      setStatus(en.error || "Enable alerts first.");
      return;
    }
    const result = await sendTestPushAlert();
    setBusy(false);
    if (result.ok) {
      setStatus(
        `Test sent to ${result.sent} device(s). Lock the phone now — look for banner + badge.`,
      );
    } else {
      setStatus(result.error || "Test failed.");
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const granted = permission === "granted";

  return (
    <div
      className={`rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-50 ${
        compact ? "px-3 py-2 text-[11px]" : "px-3 py-2.5 text-xs"
      }`}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold leading-snug">
            {!standalone
              ? "Add to Home Screen for phone alerts"
              : granted
                ? "Phone alerts"
                : "Turn on message alerts"}
          </p>
          <p className="leading-snug text-amber-100/85">
            {!standalone
              ? "iPhone: Share → Add to Home Screen → open that icon (not Safari). Then Enable alerts. Safari tabs cannot badge when closed."
              : granted
                ? "If you got no badge earlier: tap Re-enable, then Send test, then lock the phone."
                : "Allow notifications so new messages ping your phone and show a red badge when the app is closed."}
          </p>
          {status && <p className="text-[10px] font-medium text-amber-50">{status}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {!granted ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEnable(true)}
              className="rounded-lg bg-amber-400/90 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-60"
            >
              {busy ? "…" : "Enable alerts"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onTest()}
                className="rounded-lg bg-amber-400/90 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {busy ? "…" : "Send test"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onEnable(true)}
                className="rounded-lg border border-amber-300/40 px-2 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
              >
                Re-enable
              </button>
            </>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-amber-100/80 hover:bg-amber-500/20"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
