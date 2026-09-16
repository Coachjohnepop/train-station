"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PingCoachZoomModal from "@/components/PingCoachZoomModal";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";
import { markZoomJoined, readZoomJoined } from "@/lib/member-zoom-join-ui";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";

const btnClass =
  "member-zoom-header__btn inline-flex min-h-11 items-center gap-1 rounded-full border border-sky-400/50 bg-sky-950/90 px-2.5 py-1.5 text-[11px] font-bold text-sky-50 shadow-sm";

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

export default function MemberZoomHeaderButton({
  membershipPlan = null,
}: {
  membershipPlan?: string | null;
}) {
  const status = useMemberLiveZoomStatus();
  const [joined, setJoined] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);
  const freeExplorer = isFreeExplorerPlan(membershipPlan);
  const hostLive = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);

  useEffect(() => {
    if (!status?.sessionDate) {
      setJoined(false);
      return;
    }
    setJoined(readZoomJoined(status.sessionDate));
  }, [status?.sessionDate, status?.hostStarted]);

  const onJoin = useCallback(() => {
    if (!status?.sessionDate) return;
    markZoomJoined(status.sessionDate);
    setJoined(true);
  }, [status?.sessionDate]);

  if (hostLive && status?.joinUrl) {
    if (freeExplorer) {
      return (
        <Link href="/member/live" className={btnClass} aria-label="See live class">
          <LiveDot />
          Live
        </Link>
      );
    }

    const label = joined ? "Rejoin" : "Join";
    return (
      <a
        href={status.joinUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onJoin}
        className={btnClass}
        aria-label={joined ? "Rejoin live Zoom" : "Join live Zoom"}
      >
        <LiveDot />
        {label}
      </a>
    );
  }

  // Landscape used to hide the blue strip, so waiting Zoom must live in the
  // header. Portrait already has Ping Coach on the strip (CSS hides this).
  return (
    <>
      <button
        type="button"
        className={`${btnClass} member-zoom-header__btn--waiting`}
        title="Ping your coach to start the live Zoom"
        aria-label="Ping coach to start Zoom"
        onClick={() => setPingOpen(true)}
      >
        Ping Coach
      </button>
      <PingCoachZoomModal
        open={pingOpen}
        sessionDate={status?.sessionDate || undefined}
        onClose={() => setPingOpen(false)}
      />
    </>
  );
}
