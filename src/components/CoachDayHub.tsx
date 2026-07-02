"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CoachLiveFloorZoomPanel from "@/components/CoachLiveFloorZoomPanel";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import type { CoachDayStudentCard } from "@/lib/coach-day";

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

type DrillDown = {
  tile: LiveFloorTile;
  workout: MemberWorkoutView;
  memberName: string;
  instructorName: string;
  sessionDate: string;
};

function SetDots({ done, total }: { done: number; total: number }) {
  const count = Math.min(Math.max(total, 1), 6);
  const filled = Math.min(done, count);
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full ${
            i < filled ? "bg-emerald-400" : "bg-[var(--surface-2)] ring-1 ring-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

function Stoplight({ status }: { status: "waiting" | "active" | "done" | "none" }) {
  if (status === "none") {
    return (
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--surface-2)] ring-2 ring-[var(--border)]"
        aria-hidden
      />
    );
  }
  if (status === "waiting") {
    return (
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        title="Invited"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
      title="In workout"
      aria-hidden
    />
  );
}

function statusLabel(status: LiveFloorTile["status"]): string {
  if (status === "done") return "Done";
  if (status === "active") return "Working";
  return "Ready";
}

export default function CoachDayHub({
  variant = "floor",
  sessionDate,
  dateLabel,
  students: initialStudents,
  coachEmail: _coachEmail,
}: {
  variant?: "floor";
  sessionDate: string;
  dateLabel: string;
  students: CoachDayStudentCard[];
  coachEmail: string;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [tiles, setTiles] = useState<LiveFloorTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const tileByUser = useMemo(() => new Map(tiles.map((t) => [t.userId, t])), [tiles]);
  const assignedStudents = students.filter((s) => s.assigned);

  const applyTiles = useCallback((data: { tiles: LiveFloorTile[] }) => {
    setTiles(data.tiles);
    setLoading(false);
  }, []);

  const loadFloor = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/live-floor?date=${sessionDate}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) applyTiles(data);
    } catch {
      setLoading(false);
    }
  }, [sessionDate, applyTiles]);

  useEffect(() => {
    setLoading(true);
    void loadFloor();
  }, [loadFloor]);

  useEffect(() => {
    const source = new EventSource(`/api/admin/live-floor/stream?date=${sessionDate}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.floor?.tiles) applyTiles(payload.floor);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [sessionDate, applyTiles]);

  async function openDrillDown(student: CoachDayStudentCard) {
    const tile = tileByUser.get(student.id);
    if (!tile || !student.workoutId) return;
    setDrillLoading(true);
    try {
      const params = new URLSearchParams({
        userId: student.id,
        workoutId: student.workoutId,
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

  const isFloor = variant === "floor";

  return (
    <>
      <div
        className={`coach-dashboard space-y-3 ${isFloor ? "min-h-[calc(100dvh-3.5rem)] pb-2" : ""}`}
      >
        <CoachLiveFloorZoomPanel sessionDate={sessionDate} />

        <header className={isFloor ? "py-1" : "card border-accent/30 bg-accent/5 py-4"}>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Go to Today</p>
          <h1 className="mt-0.5 text-lg font-bold sm:text-xl">{dateLabel}</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Tap a name to count sets — live on member phones
          </p>
        </header>

        <section className="min-h-0 flex-1">
          <div
            className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${
              students.length >= 3 ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            {assignedStudents.map((student) => {
              const tile = tileByUser.get(student.id);
              const lightStatus = tile?.status ?? "none";
              return (
                <button
                  key={student.id}
                  type="button"
                  disabled={drillLoading || !student.workoutId}
                  onClick={() => void openDrillDown(student)}
                  className={`flex min-h-[108px] flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                    tile?.status === "done"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : tile?.status === "active"
                        ? "border-accent/50 bg-accent/10"
                        : tile?.status === "waiting"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-2">
                      <Stoplight status={lightStatus} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-bold leading-tight">{student.name}</p>
                          {tile && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
                              {statusLabel(tile.status)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">
                          {student.workoutTitle || "Workout"}
                        </p>
                        {tile?.activeExercise && (
                          <p className="mt-1 text-sm font-medium text-accent line-clamp-1">
                            {tile.activeExercise}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {tile ? (
                      <>
                        <SetDots done={tile.setsCompleted} total={tile.setsTotal} />
                        <p className="text-[10px] font-semibold text-accent">Tap to count sets →</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-[var(--muted)]">
                        {loading ? "Loading…" : "Tap to count sets →"}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {assignedStudents.length === 0 && (
            <div className="card py-10 text-center">
              <p className="text-sm font-medium">No workouts assigned for today yet.</p>
              <Link href="/admin/day" className="mt-3 inline-block text-sm text-accent hover:underline">
                ← Dashboard to publish a class
              </Link>
            </div>
          )}
        </section>
      </div>

      {drillDown ? (
        <div className="coach-dashboard fixed inset-0 z-50 flex flex-col bg-[var(--bg)] xl:flex-row">
          <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 xl:hidden">
            <button
              type="button"
              className="btn-primary min-h-[48px] px-5 text-base font-bold"
              onClick={() => setDrillDown(null)}
            >
              ← Done
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-base font-bold">{drillDown.memberName}</p>
              <p className="truncate text-xs text-[var(--muted)]">{drillDown.tile.workoutTitle}</p>
            </div>
            <span className="w-16" />
          </header>
          <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] xl:flex">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <button
                type="button"
                className="btn-ghost w-full text-sm font-semibold"
                onClick={() => setDrillDown(null)}
              >
                ← Back to class
              </button>
            </div>
            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Jump to student
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 space-y-1">
              {assignedStudents.map((s) => {
                const active = s.id === drillDown.tile.userId;
                const tile = tileByUser.get(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.workoutId || drillLoading}
                    onClick={() => void openDrillDown(s)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-accent bg-accent/15 font-semibold text-accent"
                        : "border-transparent hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="block truncate">{s.name}</span>
                    {tile && (
                      <span className="text-[10px] text-[var(--muted)]">
                        {tile.setsCompleted}/{tile.setsTotal} sets
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="hidden shrink-0 border-b border-[var(--border)] px-6 py-3 xl:block">
              <p className="text-lg font-bold">{drillDown.memberName}</p>
              <p className="text-sm text-[var(--muted)]">{drillDown.tile.workoutTitle}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 xl:px-6">
              <p className="mb-2 text-center text-[10px] text-[var(--success)] xl:text-left">
                Checkoffs sync live — member sees greens on their phone
              </p>
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
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}