"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMemberLiveZoomStatus } from "@/lib/use-member-live-zoom-status";
import {
  LIVE_CLASS_POLL_MS,
  isLiveClassSessionGoing,
} from "@/lib/session-live-poll";

/**
 * Refresh when coach publishes/replaces the member's class for this date.
 * Watches session id, workout id, and assignment stamp (createdAt) so mid-live
 * edits that reuse the same workout id still push to the member device.
 */
export default function TodayPageLiveRefresh({
  userId,
  viewDate,
  sessionId,
  workoutId,
  assignmentStamp,
}: {
  userId: string;
  viewDate: string;
  sessionId?: string | null;
  workoutId?: string | null;
  /** ISO createdAt from today session — bumped on every deploy/replace. */
  assignmentStamp?: string | null;
}) {
  const router = useRouter();
  const liveClassOn = isLiveClassSessionGoing(useMemberLiveZoomStatus());
  const lastSessionId = useRef(sessionId ?? null);
  const lastWorkoutId = useRef(workoutId ?? null);
  const lastStamp = useRef(assignmentStamp ?? null);

  useEffect(() => {
    lastSessionId.current = sessionId ?? null;
    lastWorkoutId.current = workoutId ?? null;
    lastStamp.current = assignmentStamp ?? null;
  }, [sessionId, workoutId, assignmentStamp]);

  useEffect(() => {
    const poll = async () => {
      try {
        const q = new URLSearchParams({ userId, date: viewDate });
        const res = await fetch(`/api/today?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const s = data.session as {
          id?: string;
          workoutId?: string;
          createdAt?: string;
        } | null;
        const nextId = s?.id ?? null;
        const nextWorkout = s?.workoutId ?? null;
        const nextStamp = s?.createdAt ?? null;
        if (
          nextId !== lastSessionId.current ||
          nextWorkout !== lastWorkoutId.current ||
          nextStamp !== lastStamp.current
        ) {
          lastSessionId.current = nextId;
          lastWorkoutId.current = nextWorkout;
          lastStamp.current = nextStamp;
          router.refresh();
        }
      } catch {
        // ignore
      }
    };

    void poll();
    if (!liveClassOn) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void poll();
    }, LIVE_CLASS_POLL_MS);
    return () => clearInterval(id);
  }, [userId, viewDate, router, liveClassOn]);

  return null;
}
