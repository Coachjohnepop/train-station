"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { markZoomJoined, readZoomJoined } from "@/lib/member-zoom-join-ui";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";

function dismissKey(sessionDate: string) {
  return `ts-zoom-prompt-dismissed:${sessionDate}`;
}

export default function LiveZoomJoinPrompt() {
  const status = useMemberLiveZoomStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!status) {
      setVisible(false);
      return;
    }
    // Don't nag after they've joined Zoom for this class day.
    if (readZoomJoined(status.sessionDate)) {
      setVisible(false);
      return;
    }
    const dismissed = sessionStorage.getItem(dismissKey(status.sessionDate)) === "1";
    const shouldShow =
      Boolean(status.hostStarted && status.canJoin && status.joinUrl) && !dismissed;
    setVisible(shouldShow);
  }, [status]);

  function dismiss() {
    if (status) sessionStorage.setItem(dismissKey(status.sessionDate), "1");
    setVisible(false);
  }

  function onJoin() {
    if (status?.sessionDate) markZoomJoined(status.sessionDate);
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
            onClick={onJoin}
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
