"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CoachClassDayBand from "@/components/CoachClassDayBand";
import CoachLiveFloorZoomPanel from "@/components/CoachLiveFloorZoomPanel";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import type { CoachDayStudentCard } from "@/lib/coach-day";
import type { TodaySession } from "@/lib/today-sessions";
import {
  quickAuthMetaForEmail,
  useQuickAuthDeviceId,
  writeQuickAuthMeta,
} from "@/lib/quick-auth-client";

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

function statusLabel(status: LiveFloorTile["status"]): string {
  if (status === "done") return "Done";
  if (status === "active") return "Working";
  return "Ready";
}

export default function CoachDayHub({
  sessionDate,
  dateLabel,
  calendarToday,
  students: initialStudents,
  sessionCount,
  savedSessions,
  coachEmail,
}: {
  sessionDate: string;
  dateLabel: string;
  calendarToday: string;
  students: CoachDayStudentCard[];
  sessionCount: number;
  savedSessions: TodaySession[];
  coachEmail: string;
}) {
  const router = useRouter();
  const newWorkoutRef = useRef<HTMLDivElement>(null);
  const { deviceId, ready: deviceReady } = useQuickAuthDeviceId();
  const [quickAuthEnabled, setQuickAuthEnabled] = useState<boolean | null>(null);
  const [students, setStudents] = useState(initialStudents);
  const [tiles, setTiles] = useState<LiveFloorTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newWorkoutStep, setNewWorkoutStep] = useState<"idle" | "paste" | "assign" | "done">("idle");
  const [showCascade, setShowCascade] = useState(false);
  const [newPlanText, setNewPlanText] = useState("");
  const [publishTargetIds, setPublishTargetIds] = useState<string[]>([]);
  const [publishResult, setPublishResult] = useState<{ names: string[]; built: number } | null>(null);
  const [sendSmsOnPublish, setSendSmsOnPublish] = useState(true);
  const [cascadeSourceId, setCascadeSourceId] = useState("");
  const [cascadeTargets, setCascadeTargets] = useState<string[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [publishingSaved, setPublishingSaved] = useState(false);

  const showNewWorkout = newWorkoutStep === "paste" || newWorkoutStep === "assign";

  const openNewWorkout = useCallback(() => {
    setNewWorkoutStep("paste");
    setPublishResult(null);
    setPublishTargetIds(students.map((s) => s.id));
    setShowCascade(false);
    requestAnimationFrame(() => {
      newWorkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [students]);

  const closeNewWorkout = useCallback(() => {
    setNewWorkoutStep("idle");
    setNewPlanText("");
    setPublishTargetIds([]);
  }, []);

  useEffect(() => {
    const local = quickAuthMetaForEmail(coachEmail);
    if (local?.pin || local?.webauthn) setQuickAuthEnabled(true);
  }, [coachEmail]);

  useEffect(() => {
    if (!deviceReady || !coachEmail.trim()) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/auth/quick-auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: coachEmail, deviceId }),
      });
      if (!res.ok || cancelled) return;
      const data = await res.json().catch(() => ({}));
      const enabled = Boolean(data.pin || data.webauthn);
      if (cancelled) return;
      setQuickAuthEnabled(enabled);
      writeQuickAuthMeta({
        email: coachEmail.trim().toLowerCase(),
        pin: Boolean(data.pin),
        webauthn: Boolean(data.webauthn),
        updatedAt: new Date().toISOString(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [coachEmail, deviceId, deviceReady]);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const tileByUser = useMemo(() => new Map(tiles.map((t) => [t.userId, t])), [tiles]);

  const assignedStudents = students.filter((s) => s.assigned);
  const openStudents = students.filter((s) => !s.assigned);

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
      void loadFloor();
      void router.refresh();
    } finally {
      setPublishingSaved(false);
    }
  }

  async function addStudent(userId: string) {
    setBusyId(userId);
    setMessage(null);
    try {
      const res = await fetch("/api/today/assign-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-to-primary",
          sessionDate,
          userId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not add student.");
        return;
      }
      setMessage("Student added to today's workout.");
      router.refresh();
      void loadFloor();
    } finally {
      setBusyId(null);
    }
  }

  async function runCascade() {
    if (!cascadeSourceId || cascadeTargets.length === 0) return;
    setBusyId("cascade");
    setMessage(null);
    try {
      const res = await fetch("/api/today/assign-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cascade-from",
          sessionDate,
          sourceUserId: cascadeSourceId,
          targetUserIds: cascadeTargets,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Cascade failed.");
        return;
      }
      const n = data.added?.length ?? 0;
      setMessage(n > 0 ? `Copied workout to ${n} student${n !== 1 ? "s" : ""}.` : "Everyone already had that workout.");
      setShowCascade(false);
      router.refresh();
      void loadFloor();
    } finally {
      setBusyId(null);
    }
  }

  function togglePublishTarget(id: string) {
    setPublishTargetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllPublishTargets() {
    setPublishTargetIds(students.map((s) => s.id));
  }

  const matchingSavedSession = useMemo(() => {
    const key = newPlanText.trim().replace(/\r\n/g, "\n");
    if (!key) return null;
    return (
      savedSessions.find((s) => s.rawSms.trim().replace(/\r\n/g, "\n") === key) ?? null
    );
  }, [newPlanText, savedSessions]);

  const publishingSavedClass = Boolean(matchingSavedSession);

  async function deployNewWorkout() {
    if (!newPlanText.trim()) return;
    if (publishTargetIds.length === 0) {
      setMessage("Pick at least one student to receive this workout.");
      return;
    }
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
      void loadFloor();
      void router.refresh();
      return;
    } finally {
      setSavingPlan(false);
    }
  }

  function toggleCascadeTarget(id: string) {
    setCascadeTargets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <>
      <div className="coach-dashboard space-y-5">
        {quickAuthEnabled === false && (
          <a
            href="/setup-quick-auth?redirect=/admin/day"
            className="block rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 py-3 text-sm transition hover:border-[#7c3aed]/60"
          >
            <span className="font-semibold text-[#7c3aed]">Skip typing your password tomorrow</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Set up Face ID or Touch ID once on this phone — takes 30 seconds.
            </span>
          </a>
        )}
        {quickAuthEnabled === true && (
          <Link
            href="/setup-quick-auth?redirect=/admin/day"
            className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[#7c3aed]/40 hover:text-accent"
          >
            Change Face ID / Touch ID
          </Link>
        )}

        <CoachLiveFloorZoomPanel sessionDate={sessionDate} />

        {publishResult && newWorkoutStep === "done" && (
          <div className="card space-y-3 border-emerald-500/35 bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-100">
              Published to {publishResult.names.length} student
              {publishResult.names.length !== 1 ? "s" : ""}
            </p>
            <ul className="flex flex-wrap gap-2">
              {publishResult.names.map((name) => (
                <li
                  key={name}
                  className="rounded-full border border-emerald-500/30 bg-[var(--surface)] px-3 py-1 text-xs font-medium"
                >
                  ✓ {name}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)]">
              They should see it on <strong>Go to Today</strong> now — tap a name below to count sets live.
            </p>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setPublishResult(null);
                setNewWorkoutStep("idle");
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <header className="card border-accent/30 bg-accent/5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">My class</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">{dateLabel}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {assignedStudents.length} with workouts · {openStudents.length} not yet assigned
            {sessionCount > 0 ? ` · ${sessionCount} session${sessionCount !== 1 ? "s" : ""} saved` : ""}
          </p>
          {students.length >= 3 && (
            <p className="mt-2 hidden text-xs text-sky-300/90 xl:block">
              Laptop view — all {students.length} students on one screen. Phone works great for 1–2;
              use this layout when the whole class is in.
            </p>
          )}
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (showNewWorkout) closeNewWorkout();
              else openNewWorkout();
              setShowCascade(false);
            }}
            className="btn-primary min-h-[48px] flex-1 px-4 text-sm sm:flex-none"
          >
            {showNewWorkout ? "Cancel" : "New workout"}
          </button>
          <button
            type="button"
            disabled={assignedStudents.length === 0}
            onClick={() => {
              setShowCascade((v) => !v);
              closeNewWorkout();
              if (!cascadeSourceId && assignedStudents[0]) {
                setCascadeSourceId(assignedStudents[0].id);
              }
            }}
            className="btn-ghost min-h-[48px] flex-1 px-4 text-sm sm:flex-none"
          >
            Copy to others
          </button>
          <Link
            href={`/admin/plan?date=${sessionDate}`}
            className="btn-ghost min-h-[48px] flex-1 px-4 text-center text-sm sm:flex-none"
          >
            Full planner
          </Link>
        </div>

        {sessionCount > 0 && !showNewWorkout && !showCascade && (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">
              Today&apos;s workouts are saved — tap a student to count sets, or use <strong>New workout</strong> only
              if you want to replace them.
            </p>
            {openStudents.length > 0 && (
              <button
                type="button"
                disabled={publishingSaved}
                onClick={() => void publishSavedToOpenStudents()}
                className="btn-primary shrink-0 min-h-[40px] px-3 text-xs"
              >
                {publishingSaved
                  ? "Publishing…"
                  : `Publish saved class (${openStudents.length})`}
              </button>
            )}
          </div>
        )}

        {newWorkoutStep === "paste" && (
          <div
            ref={newWorkoutRef}
            className="card space-y-3 border-amber-500/30 bg-amber-500/5"
          >
            <p className="text-sm font-semibold">1. Paste or dictate a new plan</p>
            <p className="text-xs text-[var(--muted)]">
              Type or voice-text your workout — same as texting John. Next you&apos;ll choose which
              students receive it.
            </p>
            <textarea
              className="input min-h-[140px] w-full text-sm"
              placeholder="Lower day&#10;Leg press 4 sets&#10;10,10,10,10"
              value={newPlanText}
              onChange={(e) => setNewPlanText(e.target.value)}
            />
            <CoachClassDayBand sessionDate={sessionDate} calendarToday={calendarToday} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!newPlanText.trim()}
                onClick={() => {
                  setPublishTargetIds(students.map((s) => s.id));
                  setNewWorkoutStep("assign");
                  requestAnimationFrame(() => {
                    newWorkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  });
                }}
                className="btn-primary min-h-[44px] px-4 text-sm"
              >
                Next: choose students →
              </button>
              <Link href={`/admin/plan?date=${sessionDate}`} className="btn-ghost min-h-[44px] px-3 text-xs">
                Full planner (Grok + review)
              </Link>
            </div>
          </div>
        )}

        {newWorkoutStep === "assign" && (
          <div
            ref={newWorkoutRef}
            className="card space-y-4 border-accent/30 bg-accent/5"
          >
            <CoachClassDayBand sessionDate={sessionDate} calendarToday={calendarToday} />
            <div>
              <p className="text-sm font-semibold">2. Who gets this workout?</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Tap names to include or exclude. Only selected students will see it on Go to Today.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectAllPublishTargets} className="btn-ghost text-xs px-2 py-1">
                Select all
              </button>
              <button
                type="button"
                onClick={() => setPublishTargetIds([])}
                className="btn-ghost text-xs px-2 py-1"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {students.map((s) => {
                const on = publishTargetIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => togglePublishTarget(s.id)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium min-h-[40px] ${
                      on
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {s.name}
                  </button>
                );
              })}
            </div>
            {publishTargetIds.length > 0 ? (
              <p className="text-[10px] text-[var(--success)]">
                {publishTargetIds.length} student{publishTargetIds.length !== 1 ? "s" : ""} will receive
                this workout
              </p>
            ) : (
              <p className="text-xs text-amber-300">Select at least one student to publish.</p>
            )}
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={sendSmsOnPublish}
                onChange={(e) => setSendSmsOnPublish(e.target.checked)}
              />
              SMS alert with link to Go to Today
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewWorkoutStep("paste")}
                className="btn-ghost min-h-[44px] px-3 text-sm"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={savingPlan || !newPlanText.trim() || publishTargetIds.length === 0}
                onClick={() => void deployNewWorkout()}
                className="btn-primary min-h-[44px] px-4 text-sm"
              >
                {savingPlan
                  ? publishingSavedClass
                    ? "Publishing…"
                    : "Building workout…"
                  : publishingSavedClass
                    ? "Publish saved class"
                    : "Publish to class"}
              </button>
            </div>
          </div>
        )}

        {showCascade && assignedStudents.length > 0 && (
          <div className="card space-y-3">
            <p className="text-sm font-semibold">Copy one student&apos;s workout</p>
            <label className="block text-xs">
              <span className="text-[var(--muted)]">Copy from</span>
              <select
                className="input mt-1 w-full"
                value={cascadeSourceId}
                onChange={(e) => setCascadeSourceId(e.target.value)}
              >
                {assignedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.workoutTitle}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[var(--muted)]">Give this workout to:</p>
            <div className="flex flex-wrap gap-2">
              {students
                .filter((s) => s.id !== cascadeSourceId)
                .map((s) => {
                  const on = cascadeTargets.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleCascadeTarget(s.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium min-h-[40px] ${
                        on
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-[var(--border)] text-[var(--muted)]"
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
              disabled={busyId === "cascade" || cascadeTargets.length === 0}
              onClick={() => void runCascade()}
              className="btn-primary min-h-[44px] w-full text-sm sm:w-auto"
            >
              {busyId === "cascade" ? "Copying…" : "Copy workout"}
            </button>
          </div>
        )}

        {message && (
          <p className="text-sm text-accent rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
            {message}
          </p>
        )}

        {(newWorkoutStep === "idle" || newWorkoutStep === "done") && (
          <CoachClassDayBand sessionDate={sessionDate} calendarToday={calendarToday} />
        )}

        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tap a name to count sets — members see updates live
          </p>
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
              students.length >= 3 ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            {assignedStudents.map((student) => {
              const tile = tileByUser.get(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  disabled={drillLoading || !student.workoutId}
                  onClick={() => void openDrillDown(student)}
                  className={`flex min-h-[120px] flex-col justify-between rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                    tile?.status === "done"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : tile?.status === "active"
                        ? "border-accent/50 bg-accent/10"
                        : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold leading-tight">{student.name}</p>
                      {tile && (
                        <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
                          {statusLabel(tile.status)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                      {student.workoutTitle || "Workout"}
                    </p>
                    {tile?.activeExercise && (
                      <p className="mt-2 text-sm font-medium text-accent line-clamp-1">
                        {tile.activeExercise}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
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

            {openStudents.map((student) => (
              <div
                key={student.id}
                className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-4 opacity-90"
              >
                <div>
                  <p className="text-lg font-bold">{student.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">No workout yet today</p>
                </div>
                <button
                  type="button"
                  disabled={busyId === student.id}
                  onClick={() =>
                    sessionCount === 0 ? openNewWorkout() : void addStudent(student.id)
                  }
                  className="btn-primary mt-3 min-h-[44px] w-full text-sm"
                >
                  {busyId === student.id
                    ? "Adding…"
                    : sessionCount === 0
                      ? "Create workout for class"
                      : "Add to class"}
                </button>
              </div>
            ))}
          </div>

          {students.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-sm font-medium">No students on your roster yet.</p>
              <Link href="/admin/members" className="mt-3 inline-block text-sm text-accent hover:underline">
                View members →
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