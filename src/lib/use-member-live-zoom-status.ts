"use client";

import { useEffect, useState } from "react";

export type MemberLiveZoomStatus = {
  sessionDate: string;
  roomReady: boolean;
  hostStarted: boolean;
  canJoin: boolean;
  joinUrl: string | null;
  livePageUrl: string;
};

/** Fast poll backup when SSE is on another serverless instance. */
const POLL_MS = 500;

type Listener = (status: MemberLiveZoomStatus | null) => void;

let sharedStatus: MemberLiveZoomStatus | null = null;
const listeners = new Set<Listener>();
let es: EventSource | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let started = false;

function emit(next: MemberLiveZoomStatus | null) {
  sharedStatus = next;
  for (const l of listeners) {
    try {
      l(next);
    } catch {
      /* ignore */
    }
  }
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
      // Browser will retry EventSource; poll covers the gap.
    };
  } catch {
    /* EventSource unavailable */
  }

  pollId = setInterval(() => void loadOnce(), POLL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") void loadOnce();
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
 * Instant coach→member Zoom status: shared SSE + half-second poll + focus refresh.
 * Multiple UI surfaces share one connection.
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
