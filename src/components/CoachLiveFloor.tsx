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

type DrillDown = {
  tile: LiveFloorTile;
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
          className={`h-4 w-4 rounded-full sm:h-3.5 sm:w-3.5 ${
            i < filled ? "bg-emerald-400" : "bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
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
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

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

  async function openDrillDown(tile: LiveFloorTile) {
    setDrillLoading(true);
    try {
      const params = new URLSearchParams({
        userId: tile.userId,
        workoutId: tile.workoutId,
        date: sessionDate,
      });
      const res = await fetch(`/api/admin/live-floor/workout?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      setDrillDown({
        tile,
        workout: data.workout,
        memberName: data.memberName,
        instructorName: data.instructorName,
        sessionDate: data.sessionDate,
      });
    } finally {
      setDrillLoading(false);
    }
  }

  const tiles = floor?.tiles ?? [];

  return (
    <>
      <div className="live-floor-root space-y-4">
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {tiles.map((tile) => (
              <button
                key={`${tile.userId}-${tile.workoutId}`}
                type="button"
                disabled={drillLoading}
                onClick={() => void openDrillDown(tile)}
                className={`live-floor-tile flex min-h-[140px] flex-col justify-between rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                  tile.status === "done"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : tile.status === "active"
                      ? "border-accent/50 bg-accent/10"
                      : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold leading-tight">{tile.name}</p>
                    <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {statusLabel(tile.status)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{tile.workoutTitle}</p>
                  {tile.activeExercise ? (
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-accent">{tile.activeExercise}</p>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  <SetDots done={tile.setsCompleted} total={tile.setsTotal} />
                  <p className="text-[10px] text-[var(--muted)]">
                    {tile.exercisesDone}/{tile.exercisesTotal || "—"} exercises
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          Session date
          <input
            type="date"
            className="input min-h-[44px] py-2 text-xs"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
        </label>
      </div>

      {drillDown ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <button
              type="button"
              className="btn-ghost min-h-[44px] px-4 text-sm font-semibold"
              onClick={() => setDrillDown(null)}
            >
              ← Floor
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-semibold">{drillDown.memberName}</p>
              <p className="truncate text-[10px] text-[var(--muted)]">{drillDown.tile.workoutTitle}</p>
            </div>
            <Link
              href={drillDown.tile.checkoffHref}
              className="btn-ghost shrink-0 px-2 py-1 text-[10px]"
            >
              Full view
            </Link>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4">
            <MemberWorkoutConsole
              workout={drillDown.workout}
              backHref="#"
              backLabel=""
              targetUserId={drillDown.tile.userId}
              instructorName={drillDown.instructorName}
              liveSyncUserId={drillDown.tile.userId}
              liveSessionDate={drillDown.sessionDate}
              embedded
              hideLogButton
              headerNote="Checkoffs sync live to the member."
            />
          </div>
        </div>
      ) : null}
    </>
  );
}