"use client";

/**
 * One-tap enable for phone notifications + home-screen badge.
 * Required on iPhone: Add to Home Screen first, then grant Notifications.
 */

import { useEffect, useState } from "react";
import {
  enablePushAlerts,
  getPushPermission,
  isPushSupported,
  isStandalonePwa,
} from "@/lib/push-client";

const DISMISS_KEY = "ts-push-enable-dismissed";

export default function PushAlertEnable({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const installed = isStandalonePwa();
    setStandalone(installed);

    void (async () => {
      const perm = await getPushPermission();
      if (perm === "granted") {
        // Already allowed — quietly re-sync subscription
        void enablePushAlerts();
        return;
      }
      if (perm === "denied") {
        setStatus("Notifications blocked in Settings.");
      }
      setVisible(true);
    })();
  }, []);

  async function onEnable() {
    setBusy(true);
    setStatus(null);
    const result = await enablePushAlerts();
    setBusy(false);
    if (result.ok) {
      setStatus("Alerts on — you’ll get a badge + notification for new messages.");
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setVisible(false), 2200);
    } else {
      setStatus(result.error || "Could not enable.");
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
            {standalone
              ? "Turn on message alerts"
              : "Add to Home Screen, then enable alerts"}
          </p>
          <p className="leading-snug text-amber-100/85">
            {standalone
              ? "Allow notifications so new coach messages show a red badge and ping your phone — even when the app is closed."
              : "iPhone: Share → Add to Home Screen. Open the app icon, then tap Enable alerts here. Android: Install app from the browser menu."}
          </p>
          {status && <p className="text-[10px] text-amber-100/90">{status}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEnable()}
            className="rounded-lg bg-amber-400/90 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {busy ? "…" : "Enable alerts"}
          </button>
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
