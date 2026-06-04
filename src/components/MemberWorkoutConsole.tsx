"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
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
}: {
  workout: MemberWorkoutView;
  backHref?: string;
  backLabel?: string;
  programSlug?: string;
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
  const [logResult, setLogResult] = useState<null | { performedAt: string; count: number }>(null);

  const videoModalBlock = workout.exercises.find(
    (b) => b.id === videoModalBlockId && b.videoUrl,
  );

  const toggleSet = useCallback((blockId: string, setNum: number) => {
    setCompletedSets((prev) => {
      const next = new Set(prev[blockId] ?? []);
      if (next.has(setNum)) next.delete(setNum);
      else next.add(setNum);
      return { ...prev, [blockId]: next };
    });
  }, []);

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
        if (upcoming) setActiveId(upcoming.id);
        return next;
      });
    },
    [workout.exercises],
  );

  const reopenExercise = useCallback((blockId: string) => {
    setFinishedExercises((prev) => {
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
    setActiveId(blockId);
  }, []);

  const handleLogComplete = useCallback(async () => {
    const finishedIds = Array.from(finishedExercises);
    if (finishedIds.length === 0) {
      alert("Mark at least one exercise finished before logging the workout.");
      return;
    }

    setIsLogging(true);
    try {
      const exercisesPayload = finishedIds.map((blockId) => {
        const block = workout.exercises.find((b) => b.id === blockId)!;
        const w = weights[blockId];
        const startingWeightLbs = w ? parseFloat(w) : (block.past?.startingWeightLbs ?? null);
        return {
          workoutExerciseId: block.id,
          exerciseId: block.exerciseId,
          setScheme: block.setScheme,
          weightTier: block.weightTier,
          startingWeightLbs: Number.isFinite(startingWeightLbs) ? startingWeightLbs : null,
        };
      });

      const payload: any = { exercises: exercisesPayload };
      if (programSlug) payload.programSlug = programSlug;
      const res = await fetch(`/api/workouts/${workout.workoutId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Failed to log workout");
      }

      const data = await res.json();
      setLogResult({ performedAt: data.performedAt, count: data.performances || finishedIds.length });
      // keep the finished marks so user can review what was logged
    } catch (e: any) {
      alert(e?.message || "Could not save. Check connection and try again.");
    } finally {
      setIsLogging(false);
    }
  }, [finishedExercises, workout, weights]);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Today&apos;s workout
      </p>
      <h1 className="mt-1 text-2xl font-bold">{workout.workoutName}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Hi {workout.memberName} — follow each exercise. Your last session appears
        as a faint silhouette behind the active card.
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.round((finishedExercises.size / workout.exercises.length) * 100)}%` }}
          />
        </div>
        <span className="font-medium text-accent">
          {finishedExercises.size}/{workout.exercises.length}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {workout.exercises.map((block) => {
          const isFinished = finishedExercises.has(block.id);

          if (isFinished) {
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

                {block.videoUrl && (
                  <div className="mt-3">
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
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
                  <div>
                    <span className="text-xs text-[var(--muted)]">
                      Approach
                    </span>
                    <p className="font-medium text-accent-deep">
                      {approachLabel(prescription.approach)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted)]">
                      Prescription
                    </span>
                    <p className="font-medium">{summary}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted)]">
                      Weight tier
                    </span>
                    <p className="font-medium">
                      {weightTierLabel(block.weightTier)}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-5"
                  onClick={(e) => e.stopPropagation()}
                  role="group"
                  aria-label={`${block.name} ${isTimed ? "timed set" : "set"} completion`}
                >
                  {isTimed ? (
                    <>
                      <p className="text-sm font-semibold">Timed set</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Train for {summary}
                        , then mark complete.
                      </p>
                      <button
                        type="button"
                        aria-pressed={allSetsDone}
                        className={`member-set-btn mt-3 w-full max-w-xs ${allSetsDone ? "member-set-btn--done" : ""}`}
                        onClick={() => toggleSet(block.id, 1)}
                      >
                        <span className="member-set-btn__num">
                          {allSetsDone ? "✓" : "▶"}
                        </span>
                        <span className="member-set-btn__label">
                          {allSetsDone ? "Done" : "Mark timed set complete"}
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">Log your sets</p>
                        <p className="text-xs text-[var(--muted)]">
                          {doneForBlock.size}/{block.setCount} done
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Tap each button when you finish that set.
                      </p>
                      <div
                        className={`mt-3 grid gap-2 ${
                          block.setCount <= 5
                            ? "grid-cols-5"
                            : "grid-cols-5 sm:grid-cols-10"
                        }`}
                      >
                        {Array.from({ length: block.setCount }, (_, i) => {
                          const setNum = i + 1;
                          const done = doneForBlock.has(setNum);
                          return (
                            <button
                              key={setNum}
                              type="button"
                              aria-pressed={done}
                              aria-label={`Set ${setNum}${done ? ", completed" : ""}`}
                              className={`member-set-btn ${done ? "member-set-btn--done" : ""}`}
                              onClick={() => toggleSet(block.id, setNum)}
                            >
                              <span className="member-set-btn__num">
                                {done ? "✓" : setNum}
                              </span>
                              <span className="member-set-btn__label">Set</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {allSetsDone && (
                    <p className="mt-3 text-center text-sm font-medium text-[var(--success)]">
                      {isTimed ? "Timed set complete" : "All sets logged"}
                    </p>
                  )}
                </div>

                <label className="mt-4 block" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-[var(--muted)]">
                    Starting weight today (lbs)
                  </span>
                  <input
                    className="input mt-1"
                    type="number"
                    placeholder={
                      block.past?.startingWeightLbs != null
                        ? `Last: ${block.past.startingWeightLbs} lbs`
                        : "e.g. 30"
                    }
                    value={weights[block.id] ?? ""}
                    onChange={(e) =>
                      setWeights((w) => ({
                        ...w,
                        [block.id]: e.target.value,
                      }))
                    }
                  />
                </label>

                {block.past && (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    This session will become the silhouette next time you do
                    this movement.
                  </p>
                )}

                <button
                  type="button"
                  className="btn-primary mt-6 w-full"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markExerciseFinished(block.id);
                  }}
                >
                  Exercise finished
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {logResult ? (
        <div className="mt-10 rounded-2xl border border-[var(--success)]/40 bg-[var(--success)]/10 p-6 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--success)]/20 text-xl">✓</div>
          <p className="text-lg font-semibold text-[var(--success)]">Workout logged!</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {logResult.count} exercise{logResult.count === 1 ? "" : "s"} saved. Your silhouettes are updated for next time.
          </p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Logged {new Date(logResult.performedAt).toLocaleString()}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={backHref}
              className="btn-primary inline-flex justify-center"
            >
              {backLabel}
            </Link>
            <Link href="/member" className="btn-ghost inline-flex justify-center">
              Dashboard
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => window.location.reload()}
            >
              Reload this workout
            </button>
          </div>
          <p className="mt-4 text-[10px] text-[var(--muted)]">
            Great work — consistency compounds.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary mt-10 w-full"
          onClick={handleLogComplete}
          disabled={isLogging || finishedExercises.size === 0}
        >
          {isLogging ? "Saving your session..." : "Log workout complete"}
        </button>
      )}

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