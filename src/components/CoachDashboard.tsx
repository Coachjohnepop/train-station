"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CoachClassDayBand from "@/components/CoachClassDayBand";
import type { CoachDayStudentCard } from "@/lib/coach-day";
import type { TodaySession } from "@/lib/today-sessions";

type LiveFloorTile = {
  userId: string;
  name: string;
  workoutTitle: string;
  status: "waiting" | "active" | "done";
};

type AttendanceStatus = "unassigned" | "invited" | "joined";

function stoplightClass(status: AttendanceStatus): string {
  if (status === "joined") {
    return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]";
  }
  if (status === "invited") {
    return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]";
  }
  return "bg-[var(--surface-2)] ring-2 ring-[var(--border)]";
}

function stoplightLabel(status: AttendanceStatus): string {
  if (status === "joined") return "In workout";
  if (status === "invited") return "Invited — waiting";
  return "Not on today’s workout";
}

function attendanceStatus(
  student: CoachDayStudentCard,
  tile: LiveFloorTile | undefined,
): AttendanceStatus {
  if (!student.assigned) return "unassigned";
  if (!tile) return "invited";
  if (tile.status === "active" || tile.status === "done") return "joined";
  return "invited";
}

export default function CoachDashboard({
  sessionDate,
  dateLabel,
  calendarToday,
  students: initialStudents,
  sessionCount,
  savedSessions,
}: {
  sessionDate: string;
  dateLabel: string;
  calendarToday: string;
  students: CoachDayStudentCard[];
  sessionCount: number;
  savedSessions: TodaySession[];
}) {
  const router = useRouter();
  const newWorkoutRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState(initialStudents);
  const [tiles, setTiles] = useState<LiveFloorTile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [newWorkoutStep, setNewWorkoutStep] = useState<"idle" | "paste" | "assign" | "done">("idle");
  const [newPlanText, setNewPlanText] = useState("");
  const [publishTargetIds, setPublishTargetIds] = useState<string[]>([]);
  const [publishResult, setPublishResult] = useState<{ names: string[]; built: number } | null>(null);
  const [sendSmsOnPublish] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [publishingSaved, setPublishingSaved] = useState(false);

  const showNewWorkout = newWorkoutStep === "paste" || newWorkoutStep === "assign";
  const assignedStudents = students.filter((s) => s.assigned);
  const openStudents = students.filter((s) => !s.assigned);
  const tileByUser = useMemo(() => new Map(tiles.map((t) => [t.userId, t])), [tiles]);

  const joinedCount = useMemo(
    () =>
      assignedStudents.filter((s) => {
        const tile = tileByUser.get(s.id);
        return tile?.status === "active" || tile?.status === "done";
      }).length,
    [assignedStudents, tileByUser],
  );

  const invitedCount = Math.max(0, assignedStudents.length - joinedCount);

  const matchingSavedSession = useMemo(() => {
    const key = newPlanText.trim().replace(/\r\n/g, "\n");
    if (!key) return null;
    return savedSessions.find((s) => s.rawSms.trim().replace(/\r\n/g, "\n") === key) ?? null;
  }, [newPlanText, savedSessions]);

  const publishingSavedClass = Boolean(matchingSavedSession);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const applyTiles = useCallback((data: { tiles: LiveFloorTile[] }) => {
    setTiles(
      data.tiles.map((t) => ({
        userId: t.userId,
        name: t.name,
        workoutTitle: t.workoutTitle,
        status: t.status,
      })),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/live-floor?date=${sessionDate}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok) applyTiles(data);
      } catch {
        /* ignore */
      }
    })();
  }, [sessionDate, applyTiles]);

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

  const openNewWorkout = useCallback(() => {
    setNewWorkoutStep("paste");
    setPublishResult(null);
    setPublishTargetIds(students.map((s) => s.id));
    requestAnimationFrame(() => {
      newWorkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [students]);

  const closeNewWorkout = useCallback(() => {
    setNewWorkoutStep("idle");
    setNewPlanText("");
    setPublishTargetIds([]);
  }, []);

  async function publishSavedToOpenStudents() {
    if (openStudents.length === 0) return;
    setPublishingSaved(true);
    setMessage(null);
    try {
      const res = await fetch("/api/today/assign-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-saved",
          sessionDate,
          userIds: openStudents.map((s) => s.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not publish saved class.");
        return;
      }
      const n = data.added?.length ?? 0;
      setMessage(
        n > 0
          ? `Published saved class to ${n} student${n !== 1 ? "s" : ""}.`
          : "Everyone already had today's workout.",
      );
      router.refresh();
    } finally {
      setPublishingSaved(false);
    }
  }

  async function deployNewWorkout() {
    if (!newPlanText.trim() || publishTargetIds.length === 0) return;
    const names = students
      .filter((s) => publishTargetIds.includes(s.id))
      .map((s) => s.name);
    setSavingPlan(true);
    setMessage(null);
    try {
      const scheduled = new Date(`${sessionDate}T06:30:00`);
      const res = await fetch("/api/today/cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          scheduledAt: scheduled.toISOString(),
          sendSmsAlert: sendSmsOnPublish,
          cascade: {
            rawSms: newPlanText.trim(),
            userIds: publishTargetIds,
            workoutId: publishingSavedClass ? matchingSavedSession?.workoutId : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not build workout.");
        return;
      }
      setPublishResult({ names, built: data.built ?? 1 });
      setNewWorkoutStep("done");
      setNewPlanText("");
      setPublishTargetIds([]);
      router.refresh();
    } finally {
      setSavingPlan(false);
    }
  }

  function togglePublishTarget(id: string) {
    setPublishTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="coach-dashboard flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="shrink-0 space-y-4">
        <header className="card border-accent/30 bg-accent/5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Dashboard</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">{dateLabel}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {assignedStudents.length} invited · {joinedCount} in workout · {openStudents.length} not
            assigned
          </p>
        </header>

        <Link
          href="/admin/today"
          className="btn-primary flex min-h-[72px] w-full items-center justify-center rounded-2xl px-6 text-lg font-bold tracking-tight shadow-lg shadow-accent/20 transition active:scale-[0.99]"
        >
          Go to Today →
        </Link>
        <p className="text-center text-xs text-[var(--muted)]">
          Full-screen workout floor — count sets, no sidebar, today only.
        </p>

        {publishResult && newWorkoutStep === "done" && (
          <div className="card space-y-3 border-emerald-500/35 bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-100">
              Published to {publishResult.names.length} student
              {publishResult.names.length !== 1 ? "s" : ""}
            </p>
            <Link href="/admin/today" className="btn-primary inline-flex min-h-[44px] px-4 text-sm">
              Open Go to Today
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (showNewWorkout) closeNewWorkout();
              else openNewWorkout();
            }}
            className="btn-ghost min-h-[44px] flex-1 px-4 text-sm sm:flex-none"
          >
            {showNewWorkout ? "Cancel plan" : "New workout"}
          </button>
          <Link
            href={`/admin/plan?date=${sessionDate}`}
            className="btn-ghost min-h-[44px] flex-1 px-4 text-center text-sm sm:flex-none"
          >
            Full planner
          </Link>
        </div>

        {sessionCount > 0 && !showNewWorkout && openStudents.length > 0 && (
          <button
            type="button"
            disabled={publishingSaved}
            onClick={() => void publishSavedToOpenStudents()}
            className="btn-ghost min-h-[40px] w-full text-xs"
          >
            {publishingSaved ? "Publishing…" : `Publish saved class to ${openStudents.length} more`}
          </button>
        )}

        {showNewWorkout && (
          <div ref={newWorkoutRef} className="card space-y-3 border-amber-500/30 bg-amber-500/5">
            {newWorkoutStep === "paste" && (
              <>
                <textarea
                  className="input min-h-[120px] w-full text-sm"
                  placeholder="Paste today’s plan…"
                  value={newPlanText}
                  onChange={(e) => setNewPlanText(e.target.value)}
                />
                <CoachClassDayBand sessionDate={sessionDate} calendarToday={calendarToday} />
                <button
                  type="button"
                  disabled={!newPlanText.trim()}
                  onClick={() => {
                    setPublishTargetIds(students.map((s) => s.id));
                    setNewWorkoutStep("assign");
                  }}
                  className="btn-primary min-h-[44px] px-4 text-sm"
                >
                  Choose students →
                </button>
              </>
            )}
            {newWorkoutStep === "assign" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {students.map((s) => {
                    const on = publishTargetIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => togglePublishTarget(s.id)}
                        className={`rounded-full border px-3 py-2 text-xs font-medium ${
                          on ? "border-accent bg-accent/20 text-accent" : "border-[var(--border)]"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={savingPlan || publishTargetIds.length === 0}
                  onClick={() => void deployNewWorkout()}
                  className="btn-primary min-h-[44px] w-full text-sm"
                >
                  {savingPlan ? "Publishing…" : "Publish to class"}
                </button>
              </>
            )}
          </div>
        )}

        {message && (
          <p className="text-sm text-accent rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
            {message}
          </p>
        )}
      </div>

      <section className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Today&apos;s class
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
                Invited ({invitedCount})
              </span>
              <span className="mx-2">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                Joined ({joinedCount})
              </span>
            </p>
          </div>
          <Link href="/admin/today" className="text-xs font-semibold text-accent hover:underline">
            Open floor →
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => {
              const tile = tileByUser.get(student.id);
              const status = attendanceStatus(student, tile);
              return (
                <Link
                  key={student.id}
                  href="/admin/today"
                  className={`flex min-h-[88px] items-center gap-3 rounded-xl border px-3 py-3 transition hover:border-accent/40 ${
                    status === "joined"
                      ? "border-emerald-500/35 bg-emerald-500/8"
                      : status === "invited"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full ${stoplightClass(status)}`}
                    title={stoplightLabel(status)}
                    aria-label={stoplightLabel(status)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{student.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {student.workoutTitle || stoplightLabel(status)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}