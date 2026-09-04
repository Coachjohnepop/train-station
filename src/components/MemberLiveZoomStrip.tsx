"use client";

/**
 * Sticky top strip for members:
 * - Coach actively hosting, not yet joined → full "Join Live Zoom Now" strip
 * - After Join → nothing here. Sticky header already has Rejoin (a second
 *   `position:fixed` chip inside `.member-sticky-chrome` sat under the iOS
 *   clock because backdrop-filter makes `fixed` relative to that header).
 * - Coach not live → waiting / ping affordance
 *
 * Uses SSE + tab-focus. Backup poll only while coach is live.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";
import { markZoomJoined, readZoomJoined } from "@/lib/member-zoom-join-ui";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";

type Props = {
  /** When true, strip is nested in sticky chrome (no own sticky). */
  embedded?: boolean;
  /** Membership plan — Free Explorer soft-teases Live join. */
  membershipPlan?: string | null;
};

export default function MemberLiveZoomStrip({
  embedded = false,
  membershipPlan = null,
}: Props) {
  const status = useMemberLiveZoomStatus();
  const sessionDate = status?.sessionDate ?? "";
  const [joined, setJoined] = useState(false);
  const freeExplorer = isFreeExplorerPlan(membershipPlan);

  // Join only while coach is actively hosting (not merely because a room object exists).
  // Free Explorer sees the live moment but cannot open the full Zoom join URL.
  const hostLive = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);
  const showJoin = hostLive && !freeExplorer;
  const showFreeLiveTease = hostLive && freeExplorer;

  useEffect(() => {
    if (!sessionDate) {
      setJoined(false);
      return;
    }
    setJoined(readZoomJoined(sessionDate));
  }, [sessionDate]);

  const onJoinClick = useCallback(() => {
    if (!sessionDate) return;
    markZoomJoined(sessionDate);
    setJoined(true);
  }, [sessionDate]);

  // After join, sticky header Rejoin is the only control (see file comment).
  if (showJoin && status?.joinUrl && joined) {
    return null;
  }

  // ── Free Explorer: see live, soft-block join ───────────────────
  if (showFreeLiveTease) {
    return (
      <div
        className={`border-b border-amber-500/35 bg-amber-950/40 backdrop-blur-sm ${
          embedded ? "" : "sticky top-0 z-40"
        }`}
      >
        <div className="mx-auto w-full max-w-lg space-y-2 px-4 py-2.5 md:max-w-3xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                Live class · Free sample
              </p>
              <p className="truncate text-xs text-amber-50/85">
                Coach is live — join the floor with Coach Class
              </p>
            </div>
            <Link
              href="/member/live"
              className="btn-ghost shrink-0 border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-50 sm:px-4 sm:text-sm"
            >
              See Live
            </Link>
          </div>
          <FreeUpgradeTease
            compact
            title="Live floor is Coach Class+"
            body="You can see when class is running. Upgrade to join Zoom with Coach Jeremy."
          />
        </div>
      </div>
    );
  }

  // ── Pre-join full strip (persistent until Join) ─────────────────
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
              ? "Coach is live"
              : status?.roomReady
                ? "Room ready — waiting for coach to start"
                : "Waiting for coach to open Zoom"}
          </p>
        </div>
        {showJoin && status?.joinUrl ? (
          <a
            href={status.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onJoinClick}
            className="btn-primary shrink-0 px-4 py-2 text-xs font-bold sm:px-5 sm:text-sm"
          >
            Join
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
