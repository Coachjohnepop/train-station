"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approachLabel,
  formatPastPerformance,
  formatPrescriptionSummary,
  isTimedApproach,
  normalizePrescription,
  weightTierLabel,
} from "@/lib/workout-schemes";
import MemberExerciseVideoModal from "@/components/MemberExerciseVideoModal";

export type MemberExerciseBlock = {
  id: string;
  exerciseId: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  setScheme: string;
  repPattern: string | null;
  reps: string | null;
  setCount: number;
  weightTier: string;
  past: {
    setScheme: string;
    repPattern: string | null;
    reps: string | null;
    sets: number | null;
    setsCompleted?: number | null;
    weightTier: string;
    startingWeightLbs: number | null;
    performedAt: string;
  } | null;
};

export type MemberWorkoutView = {
  workoutId: string;
  workoutName: string;
  memberName: string;
  exercises: MemberExerciseBlock[];
};

export default function MemberWorkoutConsole({
  workout,
  backHref = "/member",
  backLabel = "← Dashboard",
  programSlug,
  targetUserId,
  instructorName,
  reviewMode = false,
  calendarDateLabel,
  scheduleLabel,
  liveSyncUserId,
  liveSessionDate,
  progressMode = "live",
  hideLogButton = false,
  headerNote,
  embedded = false,
}: {
  workout: MemberWorkoutView;
  backHref?: string;
  backLabel?: string;
  programSlug?: string;
  targetUserId?: string;
  instructorName?: string;
  reviewMode?: boolean;
  /** e.g. "Tuesday, June 23, 2026" */
  calendarDateLabel?: string;
  /** e.g. "Week 1 · Tue" */
  scheduleLabel?: string;
  /** Member id for live coach ↔ member checkoff sync */
  liveSyncUserId?: string;
  liveSessionDate?: string;
  /** Persist checkoffs to warmup-progress API (pre-intake warm-ups). */
  progressMode?: "live" | "warmup";
  hideLogButton?: boolean;
  headerNote?: string;
  /** Hide title block when nested inside warm-up day navigator */
  embedded?: boolean;
}) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState(workout.exercises[0]?.id ?? "");
  const [completedSets, setCompletedSets] = useState<Record<string, Set<number>>>(
    {},
  );
  const [finishedExercises, setFinishedExercises] = useState<Set<string>>(
    new Set(),
  );
  const [videoModalBlockId, setVideoModalBlockId] = useState<string | null>(
    null,
  );
  const [isLogging, setIsLogging] = useState(false);
  const [logResult, setLogResult] = useState<null | { performedAt: string; count: number; progress?: number }>(null);
  const [finishedListExpanded, setFinishedListExpanded] = useState(false);
  const [coachLive, setCoachLive] = useState(false);
  const [partnerLive, setPartnerLive] = useState(false);
  const router = useRouter();

  const LIVE_POLL_MS = 200;
  const liveSyncEnabled =
    progressMode === "live" && !!liveSyncUserId && !reviewMode && !instructorName;
  const warmupSyncEnabled = progressMode === "warmup" && !!liveSyncUserId && !reviewMode;
  const lastAppliedRevision = useRef(0);
  const lastAppliedRemoteAt = useRef<string | null>(null);
  const applyingRemote = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef(Promise.resolve());
  const lastPushedRevision = useRef(0);
  const stateRef = useRef({
    completedSets,
    finishedExercises,
    weights,
    activeId,
  });

  const serializeCompletedSets = useCallback(
    (sets: Record<string, Set<number>>) => {
      const out: Record<string, number[]> = {};
      for (const [blockId, nums] of Object.entries(sets)) {
        out[blockId] = Array.from(nums).sort((a, b) => a - b);
      }
      return out;
    },
    [],
  );

  useEffect(() => {
    stateRef.current = { completedSets, finishedExercises, weights, activeId };
  }, [completedSets, finishedExercises, weights, activeId]);

  const applyRemoteSession = useCallback(
    (session: {
      completedSets: Record<string, number[]>;
      finishedExercises: string[];
      weights?: Record<string, string>;
      activeId?: string;
      updatedBy: "coach" | "member";
      revision?: number;
      updatedAt?: string;
    }) => {
      if (typeof session.revision === "number") {
        if (session.revision <= lastAppliedRevision.current) return;
        lastAppliedRevision.current = session.revision;
      } else if (session.updatedAt) {
        if (
          lastAppliedRemoteAt.current &&
          session.updatedAt <= lastAppliedRemoteAt.current
        ) {
          return;
        }
        lastAppliedRemoteAt.current = session.updatedAt;
      } else {
        return;
      }

      applyingRemote.current = true;
      const sets: Record<string, Set<number>> = {};
      for (const [blockId, nums] of Object.entries(session.completedSets)) {
        sets[blockId] = new Set(nums);
      }
      setCompletedSets(sets);
      setFinishedExercises(new Set(session.finishedExercises));
      if (session.weights) setWeights(session.weights);
      if (session.activeId) setActiveId(session.activeId);

      const fromCoach = session.updatedBy === "coach";
      if (instructorName) {
        setPartnerLive(!fromCoach);
      } else {
        setCoachLive(fromCoach);
      }
      applyingRemote.current = false;
    },
    [instructorName],
  );

  const flushWarmupSave = useCallback(() => {
    if (!warmupSyncEnabled || !liveSyncUserId || !liveSessionDate) return;

    saveChain.current = saveChain.current.catch(() => {}).then(async () => {
      const snap = stateRef.current;
      const res = await fetch("/api/member/warmup-progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: liveSessionDate,
          completedSets: serializeCompletedSets(snap.completedSets),
          finishedExercises: Array.from(snap.finishedExercises),
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.totalPoints === "number" && data.pointsEarned > 0) {
          window.dispatchEvent(
            new CustomEvent("member-score-updated", { detail: { totalPoints: data.totalPoints } }),
          );
        }
      }
    });

    return saveChain.current;
  }, [warmupSyncEnabled, liveSyncUserId, liveSessionDate, serializeCompletedSets]);

  const flushLiveSave = useCallback(() => {
    if (!liveSyncEnabled || !liveSyncUserId) return;

    saveChain.current = saveChain.current.catch(() => {}).then(async () => {
      const snap = stateRef.current;
      const payload = {
        userId: liveSyncUserId,
        sessionDate: liveSessionDate,
        completedSets: serializeCompletedSets(snap.completedSets),
        finishedExercises: Array.from(snap.finishedExercises),
        weights: snap.weights,
        activeId: snap.activeId,
        updatedBy: instructorName ? ("coach" as const) : ("member" as const),
      };
      const res = await fetch(`/api/workouts/${workout.workoutId}/live-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) applyRemoteSession(data.session);
      const rev = data.session?.revision;
      if (typeof rev === "number") {
        lastPushedRevision.current = rev;
      }
    });

    return saveChain.current;
  }, [
    liveSyncEnabled,
    liveSyncUserId,
    liveSessionDate,
    instructorName,
    workout.workoutId,
    serializeCompletedSets,
    applyRemoteSession,
  ]);

  const queueLiveSave = useCallback(
    (immediate = false) => {
      if (!liveSyncEnabled && !warmupSyncEnabled) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const delay = immediate ? 0 : instructorName ? 30 : 100;
      saveTimer.current = setTimeout(() => {
        if (warmupSyncEnabled) void flushWarmupSave();
        else void flushLiveSave();
      }, delay);
    },
    [liveSyncEnabled, warmupSyncEnabled, instructorName, flushLiveSave, flushWarmupSave],
  );

  useEffect(() => {
    if (!warmupSyncEnabled || !liveSessionDate) return;
    void fetch(`/api/member/warmup-progress?date=${liveSessionDate}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.progress) return;
        const sets: Record<string, Set<number>> = {};
        for (const [blockId, nums] of Object.entries(
          data.progress.completedSets as Record<string, number[]>,
        )) {
          sets[blockId] = new Set(nums);
        }
        setCompletedSets(sets);
        setFinishedExercises(new Set(data.progress.finishedExercises || []));
      })
      .catch(() => {});
  }, [warmupSyncEnabled, liveSessionDate]);

  const clearLiveSession = useCallback(async () => {
    if (!liveSyncUserId) return;
    try {
      await fetch(`/api/workouts/${workout.workoutId}/live-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: liveSyncUserId,
          sessionDate: liveSessionDate,
          clear: true,
          completedSets: {},
          finishedExercises: [],
          updatedBy: instructorName ? "coach" : "member",
        }),
      });
    } catch {
      // ignore
    }
  }, [liveSyncUserId, liveSessionDate, workout.workoutId, instructorName]);

  // Push local checkoffs to shared store (coach ↔ member).
  useEffect(() => {
    if (!liveSyncEnabled) return;
    queueLiveSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    liveSyncEnabled,
    completedSets,
    finishedExercises,
    weights,
    activeId,
    queueLiveSave,
  ]);

  // Live push via SSE (in-memory hot cache) + fast poll fallback for other instances.
  useEffect(() => {
    if (!liveSyncEnabled) return;

    const q = new URLSearchParams({ userId: liveSyncUserId! });
    if (liveSessionDate) q.set("date", liveSessionDate);
    const query = q.toString();

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/workouts/${workout.workoutId}/live-session?${query}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.session) applyRemoteSession(data.session);
      } catch {
        /* ignore */
      }
    };

    void poll();

    let es: EventSource | null = null;
    try {
      es = new EventSource(
        `/api/workouts/${workout.workoutId}/live-session/stream?${query}`,
      );
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { session?: Parameters<typeof applyRemoteSession>[0] };
          if (data.session) applyRemoteSession(data.session);
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* EventSource unavailable */
    }

    const pollId = setInterval(poll, LIVE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      es?.close();
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    liveSyncEnabled,
    liveSyncUserId,
    liveSessionDate,
    workout.workoutId,
    applyRemoteSession,
  ]);

  // Seed local completedSets from past when opening in (pure) review mode.
  // Pre-render completed sets with gold checkmarks (member-set-btn--done)
  // matching the previously logged setsCompleted. For active member or instructor sessions
  // we start empty so clicks immediately drive the green visual state.
  useEffect(() => {
    if (reviewMode && !instructorName) {
      const seed: Record<string, Set<number>> = {};
      for (const b of workout.exercises) {
        const n = b.past?.setsCompleted ?? b.past?.sets ?? 0;
        if (n > 0) {
          seed[b.id] = new Set(Array.from({ length: n }, (_, k) => k + 1));
        }
      }
      if (Object.keys(seed).length > 0) {
        setCompletedSets((prev) => ({ ...prev, ...seed }));
      }
    }
  }, [reviewMode, instructorName, workout]);

  const videoModalBlock = workout.exercises.find(
    (b) => b.id === videoModalBlockId && b.videoUrl,
  );

  // For peeking next exercise (space efficient)
  const activeIdx = workout.exercises.findIndex((e) => e.id === activeId);
  const nextExercise = workout.exercises
    .slice(activeIdx + 1)
    .find((e) => !finishedExercises.has(e.id));

  const toggleSet = useCallback(
    (blockId: string, setNum: number) => {
      setCompletedSets((prev) => {
        const next = new Set(prev[blockId] ?? []);
        if (next.has(setNum)) next.delete(setNum);
        else next.add(setNum);
        const updated = { ...prev, [blockId]: next };
        stateRef.current = { ...stateRef.current, completedSets: updated };
        return updated;
      });
      queueLiveSave(true);
    },
    [queueLiveSave],
  );

  const openVideo = useCallback((blockId: string) => {
    setVideoModalBlockId(blockId);
  }, []);

  const markExerciseFinished = useCallback(
    (blockId: string) => {
      setVideoModalBlockId((openId) => (openId === blockId ? null : openId));
      setFinishedExercises((prev) => {
        const next = new Set(prev);
        next.add(blockId);
        const idx = workout.exercises.findIndex((e) => e.id === blockId);
        const upcoming = workout.exercises
          .slice(idx + 1)
          .find((e) => !next.has(e.id));
        if (upcoming) {
          setActiveId(upcoming.id);
          stateRef.current = { ...stateRef.current, activeId: upcoming.id };
        }
        stateRef.current = { ...stateRef.current, finishedExercises: next };
        return next;
      });
      queueLiveSave(true);
    },
    [workout.exercises, queueLiveSave],
  );

  const reopenExercise = useCallback(
    (blockId: string) => {
      setFinishedExercises((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        stateRef.current = { ...stateRef.current, finishedExercises: next, activeId: blockId };
        return next;
      });
      setActiveId(blockId);
      queueLiveSave(true);
    },
    [queueLiveSave],
  );

  // Auto-finish exercise when all its sets are marked done via the "log your sets" buttons.
  useEffect(() => {
    if (reviewMode && !instructorName) return;
    let autoFinished = false;
    workout.exercises.forEach((block) => {
      if (finishedExercises.has(block.id)) return;
      const doneForBlock = completedSets[block.id] ?? new Set<number>();
      const isTimedBlock = isTimedApproach(block.setScheme);
      const allSetsDoneForBlock = isTimedBlock
        ? doneForBlock.has(1)
        : doneForBlock.size >= block.setCount;
      if (allSetsDoneForBlock) {
        autoFinished = true;
        markExerciseFinished(block.id);
      }
    });
    if (autoFinished) queueLiveSave(true);
  }, [completedSets, finishedExercises, workout.exercises, reviewMode, markExerciseFinished, instructorName, queueLiveSave]);

  const totalExercises = workout.exercises.length;
  const allExercisesFinished =
    !reviewMode && totalExercises > 0 && finishedExercises.size === totalExercises;

  useEffect(() => {
    if (allExercisesFinished) setFinishedListExpanded(false);
  }, [allExercisesFinished]);

  const handleLogComplete = useCallback(async () => {
    // Collect all exercises that were explicitly finished OR have per-set progress marked.
    // This ensures the "log your sets" buttons (per-set toggles) actually contribute setsCompleted to the log.
    const blocksWithSets = Object.keys(completedSets).filter(id => (completedSets[id]?.size ?? 0) > 0);
    let idsToLog = Array.from(new Set([...finishedExercises, ...blocksWithSets]));

    const total = workout.exercises.length;
    const progress = total > 0 ? Math.round((idsToLog.length / total) * 100) : 0;

    // Log whatever the current state is (supports 0% partial or "just noting progress")
    setIsLogging(true);
    try {
      const exercisesPayload = idsToLog.map((blockId) => {
        const block = workout.exercises.find((b) => b.id === blockId)!;
        const w = weights[blockId];
        const startingWeightLbs = w ? parseFloat(w) : (block.past?.startingWeightLbs ?? null);
        const doneForBlock = completedSets[blockId] ?? new Set<number>();
        const setsCompleted = doneForBlock.size;
        let repsCompleted = setsCompleted * 5; // default ~5 reps/set
        if (block.reps) {
          const repNum = parseInt(block.reps, 10) || 5;
          repsCompleted = setsCompleted * repNum;
        }
        // treat timed as ~12 "rep equiv" if the set was completed
        if (block.setScheme?.toLowerCase().includes("time") || block.setScheme?.toLowerCase().includes("timed")) {
          repsCompleted = setsCompleted > 0 ? 12 : 0;
        }
        return {
          workoutExerciseId: block.id,
          exerciseId: block.exerciseId,
          setScheme: block.setScheme,
          repPattern: block.repPattern,
          reps: block.reps,
          sets: block.setCount,
          weightTier: block.weightTier,
          startingWeightLbs: Number.isFinite(startingWeightLbs) ? startingWeightLbs : null,
          repsCompleted,
          setsCompleted,
        };
      });

      const payload: any = { exercises: exercisesPayload, progress };
      if (programSlug) payload.programSlug = programSlug;
      if (targetUserId) payload.targetUserId = targetUserId;
      const res = await fetch(`/api/workouts/${workout.workoutId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : typeof detail === "object" && detail !== null
              ? "Failed to log workout"
              : "Failed to log workout";
        throw new Error(message);
      }

      const data = await res.json();
      await clearLiveSession();
      setLogResult({
        performedAt: data.performedAt,
        count: data.performances || idsToLog.length,
        progress: data.progress ?? progress,
      });
      const totalPoints = data.gamification?.totalPoints;
      if (typeof totalPoints === "number") {
        window.dispatchEvent(
          new CustomEvent("member-score-updated", { detail: { totalPoints } }),
        );
      }
      requestAnimationFrame(() => {
        document.getElementById("workout-logged-success")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } catch (e: any) {
      const msg = e?.message || "Could not save. Check connection and try again.";
      if (!/gamification points/i.test(msg)) {
        alert(msg);
      }
    } finally {
      setIsLogging(false);
    }
  }, [finishedExercises, workout, weights, completedSets, activeId, programSlug, targetUserId, clearLiveSession]);

  const showLoggedSuccess = !reviewMode && !hideLogButton && !!logResult;

  return (
    <div
      className={`mx-auto w-full max-w-md md:max-w-2xl lg:max-w-2xl xl:max-w-2xl ${embedded ? "px-0 py-2 md:px-2" : "px-4 py-6 md:px-6"}`}
    >
      {showLoggedSuccess ? (
        <div
          id="workout-logged-success"
          className="rounded-2xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-6 text-center"
        >
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success)]/20 text-xl">
            ✓
          </div>
          <p className="text-lg font-semibold text-[var(--success)]">Workout logged!</p>
          <p className="mt-1 text-sm font-medium text-white">{workout.workoutName}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {logResult.count > 0
              ? `${logResult.count} exercise${logResult.count === 1 ? "" : "s"} saved. Your silhouettes are updated for next time.`
              : "Session progress noted (no exercises marked finished this time)."}
          </p>
          {logResult.progress != null && (
            <p className="mt-1 text-sm font-medium text-[var(--success)]">
              {logResult.progress}% complete{" "}
              {logResult.progress < 100
                ? "— partial (instructor sees which exercises you marked)"
                : "— full workout"}
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Logged {new Date(logResult.performedAt).toLocaleString()}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/member/today"
              className="btn-ghost inline-flex min-w-[8.5rem] justify-center"
              onClick={() => router.refresh()}
            >
              Dashboard
            </Link>
            <button
              type="button"
              className="btn-ghost min-w-[8.5rem]"
              onClick={() => window.location.reload()}
            >
              Workout
            </button>
          </div>
          <p className="mt-4 text-[10px] text-[var(--muted)]">Great work — consistency compounds.</p>
        </div>
      ) : null}

      {!showLoggedSuccess && !embedded && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {calendarDateLabel ? "Scheduled workout" : "Today\u2019s workout"}
          </p>
          {calendarDateLabel && (
            <p className="mt-1 text-sm font-medium text-white">{calendarDateLabel}</p>
          )}
          {scheduleLabel && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{scheduleLabel}</p>
          )}
          <h1 className={`${calendarDateLabel ? "mt-2" : "mt-1"} text-2xl font-bold`}>
            {workout.workoutName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {headerNote ||
              `Hi ${workout.memberName} — follow each exercise. Your last session appears as a faint silhouette behind the active card.`}
          </p>
        </>
      )}
      {!showLoggedSuccess && coachLive && !instructorName && (
        <p className="mt-2 text-xs font-medium text-[var(--success)]">
          Coach is marking your workout live — updates appear almost instantly.
        </p>
      )}
      {!showLoggedSuccess && partnerLive && instructorName && (
        <p className="mt-2 text-xs font-medium text-[var(--success)]">
          Member is logging live — their checkoffs sync here automatically.
        </p>
      )}

      {!showLoggedSuccess ? (
      <>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ramp-gold-light)] to-[var(--ramp-gold)] transition-all"
            style={{ width: `${Math.round((finishedExercises.size / workout.exercises.length) * 100)}%` }}
          />
        </div>
        <span className="font-medium text-accent">
          {finishedExercises.size}/{workout.exercises.length}
        </span>
      </div>

      {allExercisesFinished ? (
        <button
          type="button"
          className="member-workout-finished-collapse mt-4 w-full"
          onClick={() => setFinishedListExpanded((open) => !open)}
          aria-expanded={finishedListExpanded}
        >
          <span
            className={`member-workout-finished-collapse__chev ${finishedListExpanded ? "is-open" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="member-workout-finished-collapse__label">
            {finishedExercises.size} exercises complete
          </span>
          <span className="member-workout-finished-collapse__hint">
            {finishedListExpanded ? "Tap to collapse" : "Tap to review"}
          </span>
        </button>
      ) : null}

      <div className="mt-4 space-y-3">
        {workout.exercises.map((block) => {
          const isFinished = finishedExercises.has(block.id) && !reviewMode;

          if (isFinished) {
            if (allExercisesFinished && !finishedListExpanded) return null;
            return (
              <button
                key={block.id}
                type="button"
                className="member-exercise-done w-full text-left"
                onClick={() => reopenExercise(block.id)}
                aria-label={`${block.name} completed. Tap to review.`}
              >
                <span className="member-exercise-done__check" aria-hidden="true">
                  ✓
                </span>
                <span className="member-exercise-done__name">{block.name}</span>
              </button>
            );
          }

          const isActive = block.id === activeId;
          const prescription = normalizePrescription({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const isTimed = isTimedApproach(prescription.approach);
          const summary = formatPrescriptionSummary({
            setScheme: block.setScheme,
            repPattern: block.repPattern,
            reps: block.reps,
            sets: block.setCount,
          });
          const doneForBlock = completedSets[block.id] ?? new Set<number>();
          const allSetsDone = isTimed
            ? doneForBlock.has(1)
            : doneForBlock.size >= block.setCount;

          return (
            <section key={block.id} className="relative">
              {block.past && (
                <div className="member-silhouette" aria-hidden="true">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Past performance
                  </p>
                  <p className="mt-2 text-sm leading-snug">
                    {formatPastPerformance({
                      weightTier: block.past.weightTier,
                      setScheme: block.past.setScheme,
                      repPattern: block.past.repPattern,
                      reps: block.past.reps,
                      sets: block.past.sets,
                      startingWeightLbs: block.past.startingWeightLbs,
                      performedAt: block.past.performedAt,
                    })}
                  </p>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    {formatPrescriptionSummary(block.past)} ·{" "}
                    {weightTierLabel(block.past.weightTier)}
                  </p>
                </div>
              )}

              <div
                className={`member-active-card ${isActive ? "ring-2 ring-accent" : ""}`}
                onClick={() => setActiveId(block.id)}
                onKeyDown={(e) => e.key === "Enter" && setActiveId(block.id)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{block.name}</h2>
                  {isActive && (
                    <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                      Now
                    </span>
                  )}
                </div>

                {block.description && (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {block.description}
                  </p>
                )}

                <div className="mt-3">
                  {block.videoUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="badge-accent inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-110"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openVideo(block.id);
                        }}
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-xs"
                          aria-hidden="true"
                        >
                          ▶
                        </span>
                        Watch demo
                      </button>
                      <a
                        href={block.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        YouTube link →
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs italic text-[var(--muted)]">
                      No demo video linked yet — tell your instructor to add one in the exercise library.
                    </p>
                  )}
                </div>

                {/* Weight input — moved here and made more prominent per client feedback: "the first thing you do on the exercise" */}
                <label className="mt-3 block" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm font-medium text-[var(--text)]">Starting weight (lbs)</span>
                  <input
                    className="input mt-1 text-base py-2 w-full"
                    type="number"
                    placeholder={
                      block.past?.startingWeightLbs != null
                        ? `Last: ${block.past.startingWeightLbs}`
                        : "e.g. 30 — enter first"
                    }
                    value={reviewMode && block.past?.startingWeightLbs != null 
                      ? block.past.startingWeightLbs.toString() 
                      : (weights[block.id] ?? "")}
                    onChange={(e) =>
                      setWeights((w) => ({
                        ...w,
                        [block.id]: e.target.value,
                      }))
                    }
                    disabled={reviewMode && !instructorName}
                  />
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">Enter weight before logging sets (becomes your silhouette next time).</p>
                </label>

                {/* Compact two-column: scheme info (left) + log sets (right) for better space use */}
                <div className="mt-3 flex gap-3 text-sm">
                  {/* Left: Approach / Prescription / Weight tier - tighter */}
                  <div className="w-5/12 space-y-1 rounded-lg bg-[var(--surface-2)] p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Approach</span>
                      <span className="font-medium text-accent-deep">{approachLabel(prescription.approach)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Prescription</span>
                      <span className="font-medium">{summary}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Weight tier</span>
                      <span className="font-medium">{weightTierLabel(block.weightTier)}</span>
                    </div>
                  </div>

                  {/* Right: Log your sets - now side-by-side */}
                  <div
                    className="flex-1"
                    onClick={(e) => e.stopPropagation()}
                    role="group"
                    aria-label={`${block.name} ${isTimed ? "timed set" : "set"} completion`}
                  >
                    {isTimed ? (
                      <>
                        <p className="text-xs font-semibold">Timed set</p>
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                          Train for {summary}, then mark.
                        </p>
                        <button
                          type="button"
                          aria-pressed={allSetsDone}
                          className={`member-set-btn mt-2 w-full text-xs py-1 ${allSetsDone ? "member-set-btn--done" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSet(block.id, 1);
                          }}
                          disabled={reviewMode && !instructorName}
                        >
                          <span className="member-set-btn__num text-sm">
                            {allSetsDone ? "✓" : "▶"}
                          </span>
                          <span className="member-set-btn__label text-[9px]">
                            {allSetsDone ? "Done" : "Mark complete"}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-xs font-semibold">Log your sets</p>
                          <p className="text-[10px] text-[var(--muted)]">
                            {doneForBlock.size}/{block.setCount}
                          </p>
                        </div>
                        <div className="mt-1 grid grid-cols-5 gap-1">
                          {Array.from({ length: block.setCount }, (_, i) => {
                            const setNum = i + 1;
                            const done = doneForBlock.has(setNum);
                            return (
                              <button
                                key={setNum}
                                type="button"
                                aria-pressed={done}
                                aria-label={`Set ${setNum}${done ? ", completed" : ""}`}
                                className={`member-set-btn text-xs py-0.5 ${done ? "member-set-btn--done" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSet(block.id, setNum);
                                }}
                                disabled={reviewMode && !instructorName}
                              >
                                <span className="member-set-btn__num text-sm">
                                  {done ? "✓" : setNum}
                                </span>
                                <span className="member-set-btn__label text-[8px]">Set</span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {allSetsDone && (
                      <p className="mt-1 text-center text-[10px] font-medium text-[var(--ramp-gold-light)]">
                        {isTimed ? "Timed complete" : "Sets logged"}
                      </p>
                    )}
                  </div>
                </div>

                {/* (weight input moved above the sets grid for prominence) */}

                {/* Peek next exercise - space efficient teaser */}
                {nextExercise && isActive && (
                  <div className="mt-1 text-[10px] text-[var(--muted)] flex items-center gap-1">
                    <span>Next:</span>{" "}
                    <span className="font-medium text-[var(--text)] truncate">{nextExercise.name}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary mt-3 w-full text-sm py-1.5"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markExerciseFinished(block.id);
                  }}
                  disabled={reviewMode && !instructorName}
                >
                  {reviewMode && !instructorName ? "Session already logged (review)" : instructorName ? "Mark done for member" : "Exercise finished"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      </>
      ) : null}

      {!showLoggedSuccess && !reviewMode && !hideLogButton ? (
        <button
          type="button"
          className="btn-primary mt-10 w-full"
          onClick={handleLogComplete}
          disabled={isLogging}
        >
          {isLogging ? "Saving your session..." : "Log workout complete"}
        </button>
      ) : null}

      {videoModalBlock?.videoUrl && (
        <MemberExerciseVideoModal
          exerciseName={videoModalBlock.name}
          videoUrl={videoModalBlock.videoUrl}
          onClose={() => setVideoModalBlockId(null)}
        />
      )}
    </div>
  );
}