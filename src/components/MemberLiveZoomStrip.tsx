"use client";

/**
 * Sticky top strip for members:
 * - Coach actively hosting → "Join Live Zoom Now"
 * - Otherwise always show a Zoom affordance → "Ping Coach to Start Zoom"
 *   (never hide the whole strip — notifications must not replace Zoom).
 *
 * Polls fast so members see Join within a few seconds of coach Join Live Now.
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

type Props = {
  /** When true, strip is nested in sticky chrome (no own sticky). */
  embedded?: boolean;
};

/** How often members re-check live Zoom status while the app is open. */
const POLL_MS = 3_000;

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
    const id = setInterval(() => void load(), POLL_MS);

    // Immediate refresh when member returns to the tab / app.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onFocus = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Join only while coach is actively hosting (not merely because a room object exists).
  const showJoin = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);

  // Quiet loading — avoid flashing a false Join before the first status response.
  if (!status) {
    return (
      <div
        className={`border-b border-sky-500/20 bg-sky-950/70 ${
          embedded ? "" : "sticky top-0 z-40"
        }`}
      >
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-2 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
              Live class
            </p>
            <p className="truncate text-xs text-sky-100/70">Checking Zoom…</p>
          </div>
          <Link
            href="/member/live"
            className="btn-ghost shrink-0 border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100/90 sm:px-4 sm:text-sm"
          >
            Live Zoom
          </Link>
        </div>
      </div>
    );
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
          <p className="truncate text-xs text-sky-100/80">
            {showJoin
              ? "Coach is live — join the room"
              : status.roomReady
                ? "Room ready — waiting for coach to start"
                : "Waiting for coach to open Zoom"}
          </p>
        </div>
        {showJoin && status.joinUrl ? (
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
