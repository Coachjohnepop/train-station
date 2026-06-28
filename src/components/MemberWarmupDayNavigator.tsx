"use client";

import { useCallback, useRef } from "react";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import type { MemberDaySummary } from "@/lib/member-day-window-types";
import { isWarmupExerciseName } from "@/lib/warmup-template";

type Props = {
  days: MemberDaySummary[];
  todayIso: string;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  warmupWorkout: MemberWorkoutView;
  programSlug: string;
  targetUserId: string;
};

function phaseLabel(summary: MemberDaySummary, todayIso: string): string {
  if (summary.iso === todayIso) return "Today's workout";
  if (summary.phase === "past") return `${summary.weekday} — what you did`;
  return `${summary.weekday} — coming up`;
}

function WarmupPreviewPanel({
  summary,
  warmupWorkout,
  todayIso,
}: {
  summary: MemberDaySummary;
  warmupWorkout: MemberWorkoutView;
  todayIso: string;
}) {
  const isToday = summary.iso === todayIso;
  const tier = summary.visibilityTier;
  const mainExercises = summary.exerciseNames.filter((n) => !isWarmupExerciseName(n));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        {phaseLabel(summary, todayIso)}
      </p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <h2 className="text-2xl font-bold">Warm-up</h2>
        {!isToday && (
          <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Preview
          </span>
        )}
      </div>

      {tier === "label" ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {summary.themeLabel || summary.workoutName || summary.dayLabel}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {summary.shortDate} · Full exercises and sets unlock closer to this day.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-[var(--muted)]">
            {isToday
              ? "Exercise names only — spin to today to check off sets."
              : "Exercise names only — sets and reps unlock on this day."}
          </p>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Warm-up blocks
            </p>
            <ul className="mt-2 space-y-2">
              {warmupWorkout.exercises.map((ex) => (
                <li
                  key={ex.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5 text-sm font-medium"
                >
                  {ex.name}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {ex.setCount} set{ex.setCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {mainExercises.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Main workout
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
                {mainExercises.map((name) => (
                  <li key={name} className="truncate rounded-md px-1 py-0.5">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.workoutName && mainExercises.length === 0 && (
            <p className="text-sm font-medium text-[var(--text)]">{summary.workoutName}</p>
          )}
        </div>
      )}

      {!isToday && (
        <p className="mt-5 text-center text-xs text-accent">
          Swipe or use the arrows to browse days — jump to today to log sets.
        </p>
      )}
    </div>
  );
}

export default function MemberWarmupDayNavigator({
  days,
  todayIso,
  selectedDate,
  onSelectDate,
  warmupWorkout,
  programSlug,
  targetUserId,
}: Props) {
  const touchStartX = useRef<number | null>(null);
  const idx = days.findIndex((d) => d.iso === selectedDate);
  const currentIdx = idx >= 0 ? idx : days.findIndex((d) => d.iso === todayIso);
  const summary = days[currentIdx] ?? null;
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < days.length - 1;

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    onSelectDate(days[currentIdx - 1].iso);
  }, [canPrev, currentIdx, days, onSelectDate]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    onSelectDate(days[currentIdx + 1].iso);
  }, [canNext, currentIdx, days, onSelectDate]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  if (!summary) return null;

  const isToday = summary.iso === todayIso;
  const showFullWarmup = isToday && summary.visibilityTier === "full";

  return (
    <div className="warmup-nav-shell">
      <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-[var(--muted)] md:hidden">
        <span>Swipe left or right to change days</span>
      </div>

      <button
        type="button"
        aria-label="Previous day"
        onClick={goPrev}
        disabled={!canPrev}
        className="warmup-nav-arrow warmup-nav-arrow--prev shrink-0"
      >
        <span aria-hidden className="text-5xl font-light leading-none">
          ‹
        </span>
      </button>

      <div
        className="warmup-nav-body min-w-0 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
          {showFullWarmup ? (
            <div className="min-w-0 sm:mx-0">
              <div className="sm:px-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                  Today&apos;s workout
                </p>
                <h2 className="mt-1 text-2xl font-bold">Warm-up</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Check off your warm-up sets before coach joins live — your coach gets a heads-up
                  when you start.
                </p>
              </div>
              <MemberWorkoutConsole
                workout={warmupWorkout}
                backHref="/member/today"
                programSlug={programSlug}
                targetUserId={targetUserId}
                liveSyncUserId={targetUserId}
                liveSessionDate={selectedDate}
                progressMode="warmup"
                hideLogButton
                embedded
              />
            </div>
          ) : (
            <WarmupPreviewPanel
              summary={summary}
              warmupWorkout={warmupWorkout}
              todayIso={todayIso}
            />
          )}
      </div>

      <button
        type="button"
        aria-label="Next day"
        onClick={goNext}
        disabled={!canNext}
        className="warmup-nav-arrow warmup-nav-arrow--next shrink-0"
      >
        <span aria-hidden className="text-5xl font-light leading-none">
          ›
        </span>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          className="warmup-nav-arrow-mobile flex-1"
        >
          ‹ Prev day
        </button>
        <span className="text-center text-[11px] text-[var(--muted)]">
          {summary.shortDate}
          {isToday ? (
            <span className="ml-1 font-semibold text-accent">· Today</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          className="warmup-nav-arrow-mobile flex-1"
        >
          Next day ›
        </button>
      </div>
    </div>
  );
}