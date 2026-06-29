"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LiveFloorTile = {
  userId: string;
  name: string;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/live-floor?date=${sessionDate}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setFloor(data);
    } finally {
      setLoading(false);
    }
  }, [sessionDate]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const tiles = floor?.tiles ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
            {sessionDate}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {loading
              ? "Loading floor…"
              : `${tiles.length} student${tiles.length === 1 ? "" : "s"} on deck`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost text-xs px-3 py-2" onClick={() => void load()}>
            Refresh
          </button>
          <Link href={`/admin/today?date=${sessionDate}`} className="btn-ghost text-xs px-3 py-2">
            Today plan
          </Link>
        </div>
      </div>

      {tiles.length === 0 && !loading ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium">No live students assigned yet.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Assign workouts on Today, then open Live Floor during the session.
          </p>
          <Link href={`/admin/today?date=${sessionDate}`} className="btn-primary mt-4 text-sm">
            Go to Today
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {tiles.map((tile) => (
            <Link
              key={tile.userId}
              href={tile.checkoffHref}
              className={`live-floor-tile flex min-h-[132px] flex-col justify-between rounded-2xl border p-4 transition active:scale-[0.98] ${
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
                  <p className="mt-2 text-sm font-medium text-accent">{tile.activeExercise}</p>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                <SetDots done={tile.setsCompleted} total={tile.setsTotal} />
                <p className="text-[10px] text-[var(--muted)]">
                  {tile.exercisesDone}/{tile.exercisesTotal || "—"} exercises
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
        Session date
        <input
          type="date"
          className="input py-1 text-xs"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />
      </label>
    </div>
  );
}