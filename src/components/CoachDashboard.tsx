"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CoachClassDayBand from "@/components/CoachClassDayBand";
import CoachLessonPlanBuilder from "@/components/CoachLessonPlanBuilder";
import CoachNeedsDonePanel from "@/components/CoachNeedsDonePanel";
import CoachStartHereCard from "@/components/CoachStartHereCard";
import type { CoachMemberOption } from "@/components/CoachMemberPicker";
import type { CoachDayStudentCard, CoachDaySummary } from "@/lib/coach-day";
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
  return "Not assigned — plan a class";
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
  calendarToday,
  dateLabel,
  students: initialStudents,
  sessionCount,
  savedSessions,
  memberOptions,
  daySummaries = {},
  initialPlanOpen = false,
}: {
  sessionDate: string;
  calendarToday: string;
  dateLabel: string;
  students: CoachDayStudentCard[];
  sessionCount: number;
  savedSessions: TodaySession[];
  memberOptions: CoachMemberOption[];
  daySummaries?: Record<string, CoachDaySummary>;
  initialPlanOpen?: boolean;
}) {
  const router = useRouter();
  const newWorkoutRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState(initialStudents);
  const [tiles, setTiles] = useState<LiveFloorTile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showPlanWorkout, setShowPlanWorkout] = useState(initialPlanOpen);
  const [publishingSaved, setPublishingSaved] = useState(false);
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
  const isCalendarToday = sessionDate === calendarToday;
  const selectedDaySummary = daySummaries[sessionDate];
  const classSectionLabel = isCalendarToday ? "Today's class" : "Class roster";

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  useEffect(() => {
    if (!initialPlanOpen) return;
    setShowPlanWorkout(true);
    requestAnimationFrame(() => {
      newWorkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [initialPlanOpen]);

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

  const openPlanWorkout = useCallback(() => {
    setShowPlanWorkout(true);
    requestAnimationFrame(() => {
      newWorkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const closePlanWorkout = useCallback(() => {
    setShowPlanWorkout(false);
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

  return (
    <div className="coach-dashboard flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="shrink-0 space-y-4">
        <header className="card border-accent/30 bg-accent/5 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Dashboard</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">{dateLabel}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {assignedStudents.length} invited · {joinedCount} in workout · {openStudents.length} not
              assigned
            </p>
            {selectedDaySummary?.hasWorkout ? (
              <p className="mt-1 text-xs text-[var(--success)]">
                ✓ {selectedDaySummary.title || "Workout planned"} · {selectedDaySummary.assignedCount}{" "}
                assigned
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--muted)]">No workout on this day yet</p>
            )}
          </div>
          <CoachClassDayBand
            sessionDate={sessionDate}
            calendarToday={calendarToday}
            daySummaries={daySummaries}
            planOpen={showPlanWorkout}
          />
        </header>

        {/* Coach app 101 — job map (dismissible). Preview review before prod. */}
        <CoachStartHereCard />

        {isCalendarToday ? (
          <>
            <Link
              href="/admin/today"
              className="btn-primary flex min-h-[72px] w-full items-center justify-center rounded-2xl px-6 text-lg font-bold tracking-tight shadow-lg shadow-accent/20 transition active:scale-[0.99]"
            >
              Go to Today →
            </Link>
            <p className="text-center text-xs text-[var(--muted)]">
              Live floor for counting sets — left nav stays available (hide with ✕ if you need space).
            </p>
          </>
        ) : (
          <p className="text-center text-xs text-[var(--muted)]">
            Planning for a future day — use <strong>Go to Today</strong> on class day to run the floor.
          </p>
        )}

        <CoachNeedsDonePanel compact />

        <div className="space-y-1.5">
          <p className="text-[11px] text-[var(--muted)]">
            Members follow their{" "}
            <Link href="/admin/programs" className="text-accent hover:underline">
              program schedule
            </Link>{" "}
            by default. To put everyone on a shared class for this day (or SMS), use{" "}
            <strong className="text-[var(--text)]">Plan / assign class</strong> below — not Go to
            Today until someone is assigned.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (showPlanWorkout) closePlanWorkout();
                else openPlanWorkout();
              }}
              className={
                showPlanWorkout
                  ? "btn-ghost min-h-[44px] w-full px-4 text-sm sm:w-auto"
                  : openStudents.length > 0
                    ? "btn-primary min-h-[44px] w-full px-4 text-sm sm:w-auto"
                    : "btn-ghost min-h-[44px] w-full px-4 text-sm sm:w-auto"
              }
            >
              {showPlanWorkout
                ? "Cancel planning"
                : openStudents.length > 0
                  ? `Plan / assign class (${openStudents.length} need a workout)`
                  : "Plan / assign class (override)"}
            </button>
          </div>
        </div>

        {sessionCount > 0 && !showPlanWorkout && openStudents.length > 0 && (
          <button
            type="button"
            disabled={publishingSaved}
            onClick={() => void publishSavedToOpenStudents()}
            className="btn-ghost min-h-[40px] w-full text-xs"
          >
            {publishingSaved ? "Publishing…" : `Publish saved class to ${openStudents.length} more`}
          </button>
        )}

        {showPlanWorkout && (
          <div ref={newWorkoutRef}>
            <CoachLessonPlanBuilder
              key={sessionDate}
              sessionDate={sessionDate}
              viewDateLabel={dateLabel}
              memberOptions={memberOptions}
              savedSessions={savedSessions}
              embedded
              onPublished={() => router.refresh()}
            />
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
              {classSectionLabel}
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
          {isCalendarToday ? (
            <Link href="/admin/today" className="text-xs font-semibold text-accent hover:underline">
              Open floor →
            </Link>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => {
              const tile = tileByUser.get(student.id);
              const status = attendanceStatus(student, tile);
              const cardClass = `flex min-h-[88px] items-center gap-3 rounded-xl border px-3 py-3 transition hover:border-accent/40 ${
                status === "joined"
                  ? "border-emerald-500/35 bg-emerald-500/8"
                  : status === "invited"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-[var(--border)] bg-[var(--surface)]"
              }`;
              const body = (
                <>
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
                </>
              );
              // Unassigned: open plan builder — do NOT send coach to empty Go to Today (ping-pong).
              if (status === "unassigned") {
                return (
                  <button
                    key={student.id}
                    type="button"
                    className={`${cardClass} w-full text-left`}
                    onClick={() => openPlanWorkout()}
                  >
                    {body}
                  </button>
                );
              }
              return (
                <Link key={student.id} href="/admin/today" className={cardClass}>
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}