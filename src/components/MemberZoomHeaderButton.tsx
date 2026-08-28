"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";
import { markZoomJoined, readZoomJoined } from "@/lib/member-zoom-join-ui";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";

export default function MemberZoomHeaderButton({
  membershipPlan = null,
}: {
  membershipPlan?: string | null;
}) {
  const status = useMemberLiveZoomStatus();
  const [joined, setJoined] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const freeExplorer = isFreeExplorerPlan(membershipPlan);
  const hostLive = Boolean(status?.canJoin && status?.joinUrl && status?.hostStarted);

  useEffect(() => {
    if (!status?.sessionDate) {
      setJoined(false);
      return;
    }
    setJoined(readZoomJoined(status.sessionDate));
  }, [status?.sessionDate, status?.hostStarted]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onJoin = useCallback(() => {
    if (!status?.sessionDate) return;
    markZoomJoined(status.sessionDate);
    setJoined(true);
    setOpen(false);
  }, [status?.sessionDate]);

  if (!hostLive || !status?.joinUrl) return null;

  const label = joined ? "Rejoin" : "Join";

  return (
    <div ref={wrapRef} className="member-zoom-header relative">
      <button
        type="button"
        className="member-zoom-header__btn inline-flex items-center gap-1 rounded-full border border-sky-400/50 bg-sky-950/90 px-2.5 py-1 text-[11px] font-bold text-sky-50 shadow-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {label}
      </button>
      {open ? (
        <div
          className="member-zoom-header__pop absolute right-0 top-[calc(100%+0.4rem)] z-[80] w-[min(calc(100vw-1.5rem),18rem)] rounded-2xl border border-sky-500/40 bg-[var(--surface)] p-3 shadow-xl"
          role="dialog"
          aria-label="Join live Zoom"
        >
          <p className="text-sm font-semibold text-sky-200">
            {joined ? "Rejoin Live Zoom?" : "Join Live Zoom Now?"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {freeExplorer
              ? "Coach is live. Live Zoom is Coach Class+."
              : "Your coach is live — join the class video."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {freeExplorer ? (
              <Link
                href="/member/live"
                className="btn-primary px-3 py-2 text-xs font-bold"
                onClick={() => setOpen(false)}
              >
                See Live
              </Link>
            ) : (
              <a
                href={status.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onJoin}
                className="btn-primary px-3 py-2 text-xs font-bold"
              >
                {joined ? "Rejoin Zoom" : "Join Live Zoom Now"}
              </a>
            )}
            <Link
              href="/member/live"
              className="btn-ghost px-3 py-2 text-xs"
              onClick={() => setOpen(false)}
            >
              Live page
            </Link>
            <button
              type="button"
              className="btn-ghost px-2 py-2 text-xs"
              onClick={() => setOpen(false)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
