"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";

type LiveFloorTile = {
  userId: string;
  name: string;
  workoutId: string;
  workoutTitle: string;
  activeExercise: string | null;
  setsCompleted: number;
  setsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
  status: "waiting" | "active" | "done";
  checkoffHref: string;
};

type FloorResponse = {
  sessionDate: string;
  tiles: LiveFloorTile[];
  assignedCount: number;
};

type LoadedWorkout = {
  workout: MemberWorkoutView;
  memberName: string;
  instructorName: string;
  sessionDate: string;
};

function statusLabel(status: LiveFloorTile["status"]): string {
  if (status === "done") return "Done";
  if (status === "active") return "In session";
  return "Waiting";
}

function SetDots({ done, total }: { done: number; total: number }) {
  const count = Math.min(Math.max(total, 1), 8);
  const filled = Math.min(done, count);
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full ${
            i < filled
              ? "bg-[var(--ramp-gold)]"
              : "bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function CoachLiveFloor({ initialDate }: { initialDate: string }) {
  const [sessionDate, setSessionDate] = useState(initialDate);
  const [floor, setFloor] = useState<FloorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Record<string, LoadedWorkout>>({});
  const [workoutLoading, setWorkoutLoading] = useState<string | null>(null);

  const applyFloor = useCallback((data: FloorResponse) => {
    setFloor(data);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live-floor?date=${sessionDate}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) applyFloor(data);
    } catch {
      setLoading(false);
    }
  }, [sessionDate, applyFloor]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(`/api/admin/live-floor/stream?date=${sessionDate}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.floor) applyFloor(payload.floor);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [sessionDate, applyFloor]);

  const loadWorkout = useCallback(
    async (tile: LiveFloorTile) => {
      setWorkoutLoading(tile.userId);
      try {
        const params = new URLSearchParams({
          userId: tile.userId,
          workoutId: tile.workoutId,
          date: sessionDate,
        });
        const res = await fetch(`/api/admin/live-floor/workout?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        setWorkouts((prev) => ({
          ...prev,
          [tile.userId]: {
            workout: data.workout,
            memberName: data.memberName,
            instructorName: data.instructorName,
            sessionDate: data.sessionDate,
          },
        }));
      } finally {
        setWorkoutLoading(null);
      }
    },
    [sessionDate],
  );

  async function toggleStudent(tile: LiveFloorTile) {
    if (expandedUserId === tile.userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(tile.userId);
    if (!workouts[tile.userId]) {
      await loadWorkout(tile);
    }
  }

  const tiles = floor?.tiles ?? [];

  return (
    <div className="coach-dashboard live-floor-root space-y-4">
      <div className="live-floor-toolbar sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 backdrop-blur-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            {sessionDate}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {loading ? "Loading…" : `${tiles.length} on deck · live sync`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost min-h-[44px] px-3 py-2 text-xs" onClick={() => void load()}>
            Refresh
          </button>
          <Link href={`/admin/today?date=${sessionDate}`} className="btn-ghost min-h-[44px] px-3 py-2 text-xs">
            Today
          </Link>
        </div>
      </div>

      {tiles.length === 0 && !loading ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">No live students assigned yet.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Assign workouts on Today, then return here during the session.
          </p>
          <Link href={`/admin/today?date=${sessionDate}`} className="btn-primary mt-4 min-h-[44px] text-sm">
            Go to Today
          </Link>
        </div>
      ) : (
        <div className="live-floor-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {tiles.map((tile) => {
            const expanded = expandedUserId === tile.userId;
            const loaded = workouts[tile.userId];
            const isLoadingWorkout = workoutLoading === tile.userId;

            return (
              <div
                key={`${tile.userId}-${tile.workoutId}`}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                  expanded ? "col-span-full" : ""
                } ${
                  tile.status === "done"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : tile.status === "active"
                      ? "border-[var(--ramp-gold)]/45 bg-[var(--ramp-gold)]/8"
                      : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void toggleStudent(tile)}
                  className="flex w-full items-start gap-3 p-4 text-left transition active:scale-[0.995]"
                  aria-expanded={expanded}
                >
                  <span
                    className={`mt-1 shrink-0 text-xs text-[var(--ramp-gold-light)] transition-transform duration-200 ${
                      expanded ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold leading-tight">{tile.name}</p>
                      <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {statusLabel(tile.status)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{tile.workoutTitle}</p>
                    {tile.activeExercise ? (
                      <p className="mt-1 line-clamp-1 text-sm font-medium text-[var(--ramp-gold-light)]">
                        {tile.activeExercise}
                      </p>
                    ) : null}
                    <div className="mt-2 space-y-1.5">
                      <SetDots done={tile.setsCompleted} total={tile.setsTotal} />
                      <p className="text-[10px] text-[var(--muted)]">
                        {tile.exercisesDone}/{tile.exercisesTotal || "—"} exercises
                      </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--border)] px-3 pb-4 pt-2">
                    {isLoadingWorkout && !loaded ? (
                      <p className="py-4 text-center text-xs text-[var(--muted)]">Loading workout…</p>
                    ) : loaded ? (
                      <MemberWorkoutConsole
                        workout={loaded.workout}
                        backHref="#"
                        backLabel=""
                        targetUserId={tile.userId}
                        instructorName={loaded.instructorName}
                        liveSyncUserId={tile.userId}
                        liveSessionDate={loaded.sessionDate}
                        embedded
                        hideLogButton
                        coachFloorMode
                      />
                    ) : (
                      <p className="py-4 text-center text-xs text-[var(--muted)]">
                        Could not load workout — tap to retry.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
        Session date
        <input
          type="date"
          className="input min-h-[44px] py-2 text-xs"
          value={sessionDate}
          onChange={(e) => {
            setSessionDate(e.target.value);
            setExpandedUserId(null);
          }}
        />
      </label>
    </div>
  );
}