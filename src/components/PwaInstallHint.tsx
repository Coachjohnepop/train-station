"use client";

/**
 * Soft “Add to Home Screen” tip so home-screen badges can work.
 * Dismissible; not a blocking modal.
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "ts-pwa-install-hint-dismissed";

export default function PwaInstallHint({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    // Already standalone = installed
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) return;

    // Only show on mobile-ish viewports
    if (window.matchMedia("(min-width: 900px)").matches) return;

    setShow(true);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className={`rounded-xl border border-violet-600/40 bg-violet-500/15 ${
        compact ? "px-3 py-2 text-[11px]" : "px-3 py-2.5 text-xs"
      }`}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 leading-snug text-[var(--text)]">
          <strong className="font-semibold text-[var(--text)]">Add to Home Screen</strong>
          <span className="text-[var(--muted)]">
            {" "}
            for a red badge when coach messages you. iPhone: Share → Add to Home Screen. Android:
            browser menu → Install app.
          </span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg border border-violet-600/35 bg-[var(--surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text)] hover:bg-violet-500/20"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
