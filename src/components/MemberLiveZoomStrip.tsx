"use client";

/**
 * Sticky top strip for members:
 * - Coach actively hosting → "Join Live Zoom Now"
 * - Otherwise always show a Zoom affordance → "Ping Coach to Start Zoom"
 *
 * Uses SSE + 500ms poll so Join flips nearly instantly when coach starts Zoom.
 */
import Link from "next/link";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";

type Props = {
  /** When true, strip is nested in sticky chrome (no own sticky). */
  embedded?: boolean;
};

export default function MemberLiveZoomStrip({ embedded = false }: Props) {
  const status = useMemberLiveZoomStatus();

  // Join only while coach is actively hosting (not merely because a room object exists).
  const showJoin = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);

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
