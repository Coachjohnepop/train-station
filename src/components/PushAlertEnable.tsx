"use client";

/**
 * One-time prompt to enable phone notifications + home-screen badge.
 * After a successful Enable, it never shows again (manage under Account / Settings).
 */

import { useEffect, useState } from "react";
import {
  enablePushAlerts,
  getPushPermission,
  isPushAlertsPermanentlyEnabled,
  isPushSupported,
  isStandalonePwa,
  markPushAlertsPermanentlyEnabled,
} from "@/lib/push-client";

const DISMISS_LATER_KEY = "ts-push-enable-later";

export default function PushAlertEnable({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    // Already enabled once — permanent, no banner (quiet re-sync only).
    if (isPushAlertsPermanentlyEnabled()) {
      void enablePushAlerts({ forceResubscribe: false });
      return;
    }

    const installed = isStandalonePwa();
    setStandalone(installed);

    void (async () => {
      const perm = await getPushPermission();

      // Already allowed on this device before we tracked permanent flag — treat as done.
      if (perm === "granted") {
        markPushAlertsPermanentlyEnabled();
        void enablePushAlerts({ forceResubscribe: false });
        return;
      }

      try {
        if (window.localStorage.getItem(DISMISS_LATER_KEY) === "1") {
          // "Later" only hides until next session if not installed; if installed, hide for a while.
          // User can still enable from Account settings.
          return;
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

  async function onEnable() {
    setBusy(true);
    setStatus(null);
    const result = await enablePushAlerts({ forceResubscribe: true });
    setBusy(false);
    if (result.ok) {
      markPushAlertsPermanentlyEnabled();
      try {
        window.localStorage.removeItem(DISMISS_LATER_KEY);
      } catch {
        /* ignore */
      }
      setStatus("Alerts on — you won’t see this prompt again.");
      window.setTimeout(() => setVisible(false), 1200);
    } else {
      setStatus(result.error || "Could not enable.");
      if (result.standalone === false) setStandalone(false);
    }
  }

  function dismissLater() {
    try {
      window.localStorage.setItem(DISMISS_LATER_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={`rounded-xl border border-amber-600/45 bg-amber-500/20 ${
        compact ? "px-3 py-2 text-[11px]" : "px-3 py-2.5 text-xs"
      }`}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold leading-snug text-[var(--text)]">
            {!standalone ? "Add to Home Screen for phone alerts" : "Turn on message alerts"}
          </p>
          <p className="leading-snug text-[var(--muted)]">
            {!standalone
              ? "iPhone: Share → Add to Home Screen → open that icon, then Enable alerts once. You won’t be asked again."
              : "One-time setup: allow notifications so new messages ping your phone and show a badge when the app is closed. You can change this later in Account / Settings."}
          </p>
          {status && (
            <p className="text-[10px] font-semibold text-[var(--text)]">{status}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onEnable()}
            className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {busy ? "…" : "Enable alerts"}
          </button>
          <button
            type="button"
            onClick={dismissLater}
            className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
