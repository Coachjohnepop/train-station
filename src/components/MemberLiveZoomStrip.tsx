"use client";

/**
 * Sticky top strip for members:
 * - Room ready / joinable → "Join Live Zoom Now"
 * - Otherwise → "Ping Coach to Start Zoom" (opens coach chat)
 */
import { useCallback, useEffect, useState } from "react";

type LiveZoomStatus = {
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
  livePageUrl: string;
};

type Props = {
  /** When true, strip is nested in sticky chrome (no own sticky). */
  embedded?: boolean;
};

export default function MemberLiveZoomStrip({ embedded = false }: Props) {
  const [status, setStatus] = useState<LiveZoomStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/member/live-zoom/status", { cache: "no-store" });
      if (!res.ok) return;
      setStatus((await res.json()) as LiveZoomStatus);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [load]);

  // Only show Join when the API says the coach is actively hosting (not just "room exists").
  const showJoin = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);

  // Hide the whole strip when nothing is live — no false "Join Live Zoom Now".
  // Keep a quiet "Ping coach" only if we already know the status and coach isn't live.
  if (!status) return null;
  if (!showJoin) {
    // Collapsed: don't nag every page load with a big blue bar when class isn't running.
    return null;
  }

  return (
    <div
      className={`border-b border-sky-500/30 bg-sky-950/95 backdrop-blur-sm ${
        embedded ? "" : "sticky top-0 z-40"
      }`}
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-2 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
            Live class
          </p>
          <p className="truncate text-xs text-sky-100/80">Coach is live — join the room</p>
        </div>
        <a
          href={status.joinUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary shrink-0 px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
        >
          Join Live Zoom Now
        </a>
      </div>
    </div>
  );
}
