"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isWarmupMovementDone,
  type WarmupMovement,
} from "@/lib/warmup-group";

export default function MemberWarmupGroupCard({
  movements,
  finishedExercises,
  completedSets,
  restSeconds,
  videoOpen,
  onToggleMovement,
  onWatchDemo,
  onFocusChange,
}: {
  movements: WarmupMovement[];
  finishedExercises: Set<string>;
  completedSets: Record<string, Set<number>>;
  restSeconds: number;
  videoOpen?: boolean;
  onToggleMovement: (movement: WarmupMovement, origin?: HTMLElement) => void;
  onWatchDemo: (movement: WarmupMovement) => void;
  onFocusChange?: (movement: WarmupMovement) => void;
}) {
  const firstOpen = movements.find(
    (m) => !isWarmupMovementDone(m, finishedExercises, completedSets),
  );
  const [focusKey, setFocusKey] = useState(firstOpen?.key || movements[0]?.key || "");
  const focus =
    movements.find((m) => m.key === focusKey) || firstOpen || movements[0];
  const allDone = movements.every((m) =>
    isWarmupMovementDone(m, finishedExercises, completedSets),
  );
  const doneCount = movements.filter((m) =>
    isWarmupMovementDone(m, finishedExercises, completedSets),
  ).length;
  const hasTimedHold = movements.some((m) => (m.holdSeconds || 0) > 0);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    if (!allDone) setReviewOpen(false);
  }, [allDone]);

  useEffect(() => {
    if (!focus) return;
    if (!isWarmupMovementDone(focus, finishedExercises, completedSets)) return;
    const next = movements.find(
      (m) => !isWarmupMovementDone(m, finishedExercises, completedSets),
    );
    if (next) setFocusKey(next.key);
  }, [completedSets, finishedExercises, focus, movements]);

  useEffect(() => {
    if (!focus) return;
    onFocusChange?.(focus);
  }, [focus?.key, onFocusChange]);

  const cue = useMemo(() => {
    if (!focus) return null;
    if (focus.holdSeconds && focus.holdSeconds >= 60) {
      return `${Math.round(focus.holdSeconds / 60)} min hold`;
    }
    if (focus.holdSeconds) return `${focus.holdSeconds}s hold`;
    if (focus.reps && focus.setScheme === "timed") return focus.reps;
    if (focus.reps) return `${focus.reps} reps`;
    return null;
  }, [focus]);

  if (!focus) return null;

  const blockAnchors = Array.from(new Set(movements.map((m) => m.blockId))).map(
    (blockId) => (
      <span key={blockId} id={`member-exercise-${blockId}`} className="sr-only" />
    ),
  );

  if (allDone && !reviewOpen) {
    return (
      <div
        id="member-exercise-warmup-group"
        className="member-exercise-anchor space-y-2"
      >
        {blockAnchors}
        {movements.map((movement) => (
          <button
            key={movement.key}
            type="button"
            className="member-exercise-done w-full text-left"
            onClick={() => {
              setFocusKey(movement.key);
              setReviewOpen(true);
            }}
            aria-expanded={false}
            aria-label={`${movement.name} complete. Tap to review warm-up.`}
          >
            <span className="member-exercise-done__check" aria-hidden="true">
              ✓
            </span>
            <span className="member-exercise-done__body">
              <span className="member-exercise-done__name">{movement.name}</span>
              <span className="member-exercise-done__hint">Tap to review</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      id="member-exercise-warmup-group"
      className={`member-exercise-anchor rounded-2xl border p-4 ${
        allDone
          ? "border-[color-mix(in_srgb,var(--ramp-gold)_45%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_8%,var(--surface))]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      {blockAnchors}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ramp-gold-light)]">
            Warm-up
          </p>
          <h3 className="text-lg font-semibold text-[var(--text)]">{focus.name}</h3>
          {cue ? (
            <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{cue}</p>
          ) : null}
          {focus.description && focus.description !== cue ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{focus.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-[var(--muted)]">
            {doneCount}/{movements.length}
          </span>
          {allDone ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-[var(--ramp-gold-light)] underline-offset-2 hover:underline"
              onClick={() => setReviewOpen(false)}
            >
              Hide
            </button>
          ) : null}
        </div>
      </div>

      {focus.videoUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="badge-accent inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-110"
            onClick={() => onWatchDemo(focus)}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-xs">
              ▶
            </span>
            Watch demo
          </button>
          <a
            href={focus.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            YouTube link →
          </a>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">No demo for this movement yet.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {movements.map((movement) => {
          const done = isWarmupMovementDone(
            movement,
            finishedExercises,
            completedSets,
          );
          const active = movement.key === focus.key;
          return (
            <button
              key={movement.key}
              type="button"
              aria-pressed={done}
              aria-label={`${movement.label}${done ? ", completed" : ""}`}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                done
                  ? "border-[var(--ramp-gold)] bg-[var(--ramp-gold)]/20 text-[var(--ramp-gold-light)]"
                  : active
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
              }`}
              onClick={(e) => {
                setFocusKey(movement.key);
                onToggleMovement(movement, e.currentTarget);
              }}
            >
              {done ? "✓ " : ""}
              {movement.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        {restSeconds}s rest after each movement
        {hasTimedHold ? " · timed holds first" : ""}
        {videoOpen ? " · demo follows the highlighted move" : ""}
      </p>
    </div>
  );
}
