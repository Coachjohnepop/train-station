"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LiveZoomStatus = {
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
  livePageUrl: string;
};

function dismissKey(sessionDate: string) {
  return `ts-zoom-prompt-dismissed:${sessionDate}`;
}

export default function LiveZoomJoinPrompt() {
  const [status, setStatus] = useState<LiveZoomStatus | null>(null);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/member/live-zoom/status", { cache: "no-store" });
      const data = (await res.json()) as LiveZoomStatus;
      if (!res.ok) return;
      setStatus(data);
      const dismissed = sessionStorage.getItem(dismissKey(data.sessionDate)) === "1";
      const shouldShow = data.roomReady && data.canJoin && !dismissed;
      setVisible(shouldShow);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 45_000);
    return () => clearInterval(id);
  }, [load]);

  function dismiss() {
    if (status) sessionStorage.setItem(dismissKey(status.sessionDate), "1");
    setVisible(false);
  }

  if (!visible || !status) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-lg rounded-2xl border border-sky-500/40 bg-[var(--surface)] p-4 shadow-xl md:bottom-6"
      role="dialog"
      aria-labelledby="live-zoom-prompt-title"
    >
      <p id="live-zoom-prompt-title" className="text-base font-semibold text-sky-200">
        Join Live Zoom Now?
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {status.hostStarted
          ? "Your coach is live — join the class video now."
          : "Today's live class Zoom room is ready. Join when you're set."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status.joinUrl ? (
          <a
            href={status.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-4 py-2 text-sm font-bold"
          >
            Join Live Zoom Now
          </a>
        ) : null}
        <Link href="/member/live" className="btn-ghost px-4 py-2 text-sm">
          Open live page
        </Link>
        <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}