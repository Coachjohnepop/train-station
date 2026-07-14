"use client";

/**
 * Sticky top strip for members:
 * - Room ready / joinable → "Join Live Zoom Now"
 * - Otherwise → "Ping Coach to Start Zoom" (opens coach chat)
 */
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

export default function MemberLiveZoomStrip() {
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

  // Prefer API canJoin; also show join if host is live + we have a URL.
  const showJoin = Boolean(status?.joinUrl && (status.canJoin || status.hostStarted));

  return (
    <div className="sticky top-0 z-40 border-b border-sky-500/30 bg-sky-950/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-2 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
            Live class
          </p>
          <p className="truncate text-xs text-sky-100/80">
            {showJoin
              ? status?.hostStarted
                ? "Coach is live — join the room"
                : "Zoom room ready"
              : "Waiting for coach to open Zoom"}
          </p>
        </div>
        {showJoin && status?.joinUrl ? (
          <a
            href={status.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary shrink-0 px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
          >
            Join Live Zoom Now
          </a>
        ) : (
          <Link
            href="/member/chat?ping=zoom"
            className="btn-ghost shrink-0 border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 hover:bg-sky-500/25 sm:px-4 sm:text-sm"
            title="Message your coach to start the live Zoom"
          >
            Ping Coach to Start Zoom
          </Link>
        )}
      </div>
    </div>
  );
}
