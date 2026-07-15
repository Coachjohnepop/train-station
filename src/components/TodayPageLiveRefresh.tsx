"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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

    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [userId, viewDate, router]);

  return null;
}
