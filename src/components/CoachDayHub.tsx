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

type LoadedWorkout = {
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Record<string, LoadedWorkout>>({});
  const [workoutLoading, setWorkoutLoading] = useState<string | null>(null);

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

  const loadWorkout = useCallback(
    async (student: CoachDayStudentCard) => {
      if (!student.workoutId) return;
      setWorkoutLoading(student.id);
      try {
        const params = new URLSearchParams({
          userId: student.id,
          workoutId: student.workoutId,
          date: sessionDate,
        });
        const res = await fetch(`/api/admin/live-floor/workout?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        setWorkouts((prev) => ({
          ...prev,
          [student.id]: {
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

  async function toggleStudent(student: CoachDayStudentCard) {
    if (!student.workoutId) return;
    if (expandedUserId === student.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(student.id);
    if (!workouts[student.id]) {
      await loadWorkout(student);
    }
  }

  const collapseStudent = useCallback((userId: string) => {
    setExpandedUserId((current) => (current === userId ? null : current));
  }, []);

  useEffect(() => {
    if (!expandedUserId) return;
    const tile = tileByUser.get(expandedUserId);
    if (tile?.status === "done") {
      setExpandedUserId(null);
    }
  }, [expandedUserId, tileByUser]);

  const isFloor = variant === "floor";

  return (
    <>
      <div
        className={`coach-dashboard space-y-3 ${isFloor ? "min-h-[calc(100dvh-3.5rem)] pb-2" : ""}`}
      >
        <CoachLiveFloorZoomPanel sessionDate={sessionDate} variant="floor" />

        <header className={isFloor ? "py-1" : "card border-accent/30 bg-accent/5 py-4"}>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Go to Today</p>
          <h1 className="mt-0.5 text-lg font-bold sm:text-xl">{dateLabel}</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Expand a card to count sets — live on member phones
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
              const expanded = expandedUserId === student.id;
              const loaded = workouts[student.id];
              const isLoadingWorkout = workoutLoading === student.id;

              return (
                <div
                  key={student.id}
                  className={`min-w-0 overflow-hidden rounded-2xl border transition-colors ${
                    tile?.status === "done"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : tile?.status === "active"
                        ? "border-accent/50 bg-accent/10"
                        : tile?.status === "waiting"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <button
                    type="button"
                    disabled={!student.workoutId}
                    onClick={() => void toggleStudent(student)}
                    className="flex w-full items-start gap-2 p-3 text-left transition active:scale-[0.995]"
                    aria-expanded={expanded}
                  >
                    <span
                      className={`mt-1 shrink-0 text-xs text-accent transition-transform duration-200 ${
                        expanded ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    >
                      ▶
                    </span>
                    <div className="min-w-0 flex-1">
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
                      <div className="mt-2 space-y-1">
                        {tile ? (
                          <>
                            <SetDots done={tile.setsCompleted} total={tile.setsTotal} />
                            <p className="text-[10px] text-[var(--muted)]">
                              {tile.setsCompleted}/{tile.setsTotal || "—"} sets
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-[var(--muted)]">
                            {loading ? "Loading…" : "Expand to count sets"}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-[var(--border)] px-2 pb-3 pt-1.5">
                      {isLoadingWorkout && !loaded ? (
                        <p className="py-4 text-center text-xs text-[var(--muted)]">Loading workout…</p>
                      ) : loaded ? (
                        <MemberWorkoutConsole
                          workout={loaded.workout}
                          backHref="#"
                          backLabel=""
                          targetUserId={student.id}
                          instructorName={loaded.instructorName}
                          liveSyncUserId={student.id}
                          liveSessionDate={loaded.sessionDate}
                          embedded
                          hideLogButton
                          coachFloorMode
                          onCoachFloorFinished={() => collapseStudent(student.id)}
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
    </>
  );
}