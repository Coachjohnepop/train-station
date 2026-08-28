"use client";

/**
 * Sticky top strip for members:
 * - Coach actively hosting, not yet joined → full "Join Live Zoom Now" strip (persistent)
 * - After Join → compact fixed chip (Rejoin / Hide) so workout UI has room on mobile
 * - Chip hidden → tiny edge pill to restore
 * - Coach not live → waiting / ping affordance
 *
 * Uses SSE + tab-focus. Backup poll only while coach is live.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";
import {
  markZoomJoined,
  readZoomChipHidden,
  readZoomJoined,
  writeZoomChipHidden,
} from "@/lib/member-zoom-join-ui";
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
  const [chipHidden, setChipHidden] = useState(false);
  const freeExplorer = isFreeExplorerPlan(membershipPlan);

  // Join only while coach is actively hosting (not merely because a room object exists).
  // Free Explorer sees the live moment but cannot open the full Zoom join URL.
  const hostLive = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);
  const showJoin = hostLive && !freeExplorer;
  const showFreeLiveTease = hostLive && freeExplorer;

  useEffect(() => {
    if (!sessionDate) {
      setJoined(false);
      setChipHidden(false);
      return;
    }
    setJoined(readZoomJoined(sessionDate));
    setChipHidden(readZoomChipHidden(sessionDate));
  }, [sessionDate]);

  // Coach ended live → clear "joined" UI for a clean next class (date-scoped keys anyway).
  useEffect(() => {
    if (!sessionDate || !status) return;
    if (!status.hostStarted && joined) {
      // Keep joined flag for the day in case coach briefly reconnects; just don't show chip.
    }
  }, [status, sessionDate, joined]);

  const onJoinClick = useCallback(() => {
    if (!sessionDate) return;
    markZoomJoined(sessionDate);
    setJoined(true);
    setChipHidden(false);
  }, [sessionDate]);

  const hideChip = useCallback(() => {
    if (!sessionDate) return;
    writeZoomChipHidden(sessionDate, true);
    setChipHidden(true);
  }, [sessionDate]);

  const showChip = useCallback(() => {
    if (!sessionDate) return;
    writeZoomChipHidden(sessionDate, false);
    setChipHidden(false);
  }, [sessionDate]);

  // ── Post-join compact chrome (chip / edge pill) ─────────────────
  if (showJoin && status?.joinUrl && joined) {
    if (chipHidden) {
      return (
        <button
          type="button"
          onClick={showChip}
          className="member-zoom-float-chip fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-3 z-[55] flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/50 bg-sky-950/95 text-lg shadow-lg backdrop-blur-sm md:bottom-6"
          aria-label="Show Zoom live controls"
          title="Zoom live"
        >
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
        </button>
      );
    }

    return (
      <div
        className="member-zoom-float-chip fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-3 z-[55] flex max-w-[min(100vw-1.5rem,20rem)] items-center gap-1.5 rounded-2xl border border-sky-400/45 bg-sky-950/95 px-2.5 py-2 shadow-xl backdrop-blur-md md:bottom-6"
        role="status"
        aria-label="In Zoom live class"
      >
        <span
          className="relative ml-0.5 flex h-2 w-2 shrink-0"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="hidden text-[11px] font-semibold text-sky-100 sm:inline">
          In Zoom
        </span>
        <a
          href={status.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary shrink-0 px-3 py-1.5 text-[11px] font-bold"
        >
          Rejoin
        </a>
        <Link
          href="/member/live"
          className="btn-ghost shrink-0 border border-sky-400/30 px-2 py-1.5 text-[11px] font-semibold text-sky-100"
        >
          Live
        </Link>
        <button
          type="button"
          onClick={hideChip}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sky-200/80 hover:bg-sky-500/20 hover:text-sky-50"
          aria-label="Hide Zoom chip"
          title="Hide — use the green dot to show again"
        >
          ✕
        </button>
      </div>
    );
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
              ? "Coach is live — join the room"
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
