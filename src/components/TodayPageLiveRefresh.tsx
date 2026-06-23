"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Refresh when coach publishes/republishes a different workout for this member+date. */
export default function TodayPageLiveRefresh({
  userId,
  viewDate,
  sessionId,
  workoutId,
}: {
  userId: string;
  viewDate: string;
  sessionId?: string | null;
  workoutId?: string | null;
}) {
  const router = useRouter();
  const lastSessionId = useRef(sessionId ?? null);
  const lastWorkoutId = useRef(workoutId ?? null);

  useEffect(() => {
    lastSessionId.current = sessionId ?? null;
    lastWorkoutId.current = workoutId ?? null;
  }, [sessionId, workoutId]);

  useEffect(() => {
    const poll = async () => {
      try {
        const q = new URLSearchParams({ userId, date: viewDate });
        const res = await fetch(`/api/today?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const s = data.session as { id?: string; workoutId?: string } | null;
        const nextId = s?.id ?? null;
        const nextWorkout = s?.workoutId ?? null;
        if (
          nextId !== lastSessionId.current ||
          nextWorkout !== lastWorkoutId.current
        ) {
          lastSessionId.current = nextId;
          lastWorkoutId.current = nextWorkout;
          router.refresh();
        }
      } catch {
        // ignore
      }
    };

    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [userId, viewDate, router]);

  return null;
}