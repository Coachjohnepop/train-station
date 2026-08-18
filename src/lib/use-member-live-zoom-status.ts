"use client";

import { useEffect, useState } from "react";
import {
  nextHeldLiveZoomStatus,
  sameLiveZoomStatus,
} from "@/lib/live-zoom-status-hold";
import {
  LIVE_CLASS_POLL_MS,
  isLiveClassSessionGoing,
} from "@/lib/session-live-poll";

export type MemberLiveZoomStatus = {
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
  livePageUrl: string;
};

type Listener = (status: MemberLiveZoomStatus | null) => void;

let sharedStatus: MemberLiveZoomStatus | null = null;
let notLiveSince: number | null = null;
const listeners = new Set<Listener>();
let es: EventSource | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let started = false;

function emit(next: MemberLiveZoomStatus | null) {
  const held = nextHeldLiveZoomStatus(sharedStatus, next, { notLiveSince }, Date.now());
  notLiveSince = held.notLiveSince;
  if (sameLiveZoomStatus(sharedStatus, held.status)) {
    syncBackupPoll();
    return;
  }
  sharedStatus = held.status;
  for (const l of listeners) {
    try {
      l(sharedStatus);
    } catch {
      /* ignore */
    }
  }
  syncBackupPoll();
}

async function loadOnce() {
  try {
    const res = await fetch("/api/member/live-zoom/status", { cache: "no-store" });
    if (!res.ok) return;
    emit((await res.json()) as MemberLiveZoomStatus);
  } catch {
    /* ignore */
  }
}

/** Interval only while coach is live and the tab is visible. */
function syncBackupPoll() {
  const should =
    isLiveClassSessionGoing(sharedStatus) &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible";
  if (should) {
    if (pollId) return;
    pollId = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void loadOnce();
    }, LIVE_CLASS_POLL_MS);
    return;
  }
  if (pollId) {
    clearInterval(pollId);
    pollId = null;
  }
}

function ensureBus() {
  if (started) return;
  started = true;

  void loadOnce();

  try {
    es = new EventSource("/api/member/live-zoom/stream");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MemberLiveZoomStatus;
        if (data && typeof data.sessionDate === "string") emit(data);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      // Browser will retry EventSource; no idle poll.
    };
  } catch {
    /* EventSource unavailable */
  }

  const onVisible = () => {
    if (document.visibilityState === "visible") void loadOnce();
    syncBackupPoll();
  };
  const onFocus = () => void loadOnce();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onFocus);

  // Stash removers on global for cleanup when last subscriber leaves.
  (ensureBus as unknown as { _cleanup?: () => void })._cleanup = () => {
    es?.close();
    es = null;
    if (pollId) clearInterval(pollId);
    pollId = null;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    started = false;
  };
}

function releaseBus() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  const cleanup = (ensureBus as unknown as { _cleanup?: () => void })._cleanup;
  cleanup?.();
}

/**
 * Coach→member Zoom status: one GET, SSE, focus/tab return.
 * Backup poll runs only while hostStarted (live class).
 */
export function useMemberLiveZoomStatus() {
  const [status, setStatus] = useState<MemberLiveZoomStatus | null>(sharedStatus);

  useEffect(() => {
    refCount += 1;
    ensureBus();
    const listener: Listener = (next) => setStatus(next);
    listeners.add(listener);
    // Sync with current shared value.
    setStatus(sharedStatus);
    return () => {
      listeners.delete(listener);
      releaseBus();
    };
  }, []);

  return status;
}
