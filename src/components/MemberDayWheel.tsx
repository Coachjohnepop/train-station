"use client";

import { useCallback, useMemo } from "react";
import type { MemberDaySummary } from "@/lib/member-day-window-types";

const CHIP_W = 76;
const GAP = 8;
const VISIBLE_DAYS = 5;
const STEP = CHIP_W + GAP;

type Props = {
  days: MemberDaySummary[];
  selectedIso: string;
  todayIso: string;
  onSelect: (iso: string) => void;
  /** @deprecated Today chip is always gold; prop kept for API compatibility */
  highlightTodayGold?: boolean;
};

function windowStartIndex(days: MemberDaySummary[], selectedIdx: number): number {
  if (days.length <= VISIBLE_DAYS) return 0;
  const half = Math.floor(VISIBLE_DAYS / 2);
  let start = selectedIdx - half;
  if (start < 0) start = 0;
  if (start + VISIBLE_DAYS > days.length) start = days.length - VISIBLE_DAYS;
  return start;
}

export default function MemberDayWheel({
  days,
  selectedIso,
  todayIso,
  onSelect,
}: Props) {
  const selectedIdx = days.findIndex((d) => d.iso === selectedIso);
  const currentIdx = selectedIdx >= 0 ? selectedIdx : days.findIndex((d) => d.iso === todayIso);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < days.length - 1;

  const startIdx = useMemo(
    () => windowStartIndex(days, currentIdx >= 0 ? currentIdx : 0),
    [days, currentIdx],
  );

  const goPrev = useCallback(() => {
    if (!canPrev || currentIdx < 0) return;
    onSelect(days[currentIdx - 1].iso);
  }, [canPrev, currentIdx, days, onSelect]);

  const goNext = useCallback(() => {
    if (!canNext || currentIdx < 0) return;
    onSelect(days[currentIdx + 1].iso);
  }, [canNext, currentIdx, days, onSelect]);

  if (!days.length) return null;

  const viewportWidth =
    Math.min(VISIBLE_DAYS, days.length) * CHIP_W +
    (Math.min(VISIBLE_DAYS, days.length) - 1) * GAP;

  return (
    <div className="day-wheel-shell mx-auto flex max-w-full items-center justify-center gap-1 sm:gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={goPrev}
        disabled={!canPrev}
        className="day-wheel-spin day-wheel-spin--prev shrink-0"
      >
        <span aria-hidden className="day-wheel-spin__glyph" />
      </button>

      <div
        role="listbox"
        aria-label="Workout days"
        className="day-wheel-viewport shrink-0 py-2"
        style={{ width: viewportWidth }}
      >
        <div
          className="day-wheel-strip"
          style={{ transform: `translate3d(-${startIdx * STEP}px, 0, 0)` }}
        >
          {days.map((day) => {
            const isSelected = day.iso === selectedIso;
            const isToday = day.iso === todayIso;
            const todayGold = isToday;
            const chipClass = todayGold
              ? isSelected
                ? "day-wheel-chip-today-gold day-wheel-chip-today-gold--selected"
                : "day-wheel-chip-today-gold"
              : isSelected
                ? "border-[var(--accent)] bg-[var(--accent)]/12 shadow-sm"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30";

            return (
              <button
                key={day.iso}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(day.iso)}
                className={`relative flex w-[76px] shrink-0 flex-col items-center rounded-xl border px-1 py-2.5 text-center transition-colors duration-200 ${chipClass}`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    todayGold ? "text-[var(--ramp-gold-light)]" : "text-[var(--muted)]"
                  }`}
                >
                  {day.weekday}
                </span>
                <span
                  className={`mt-0.5 text-sm font-bold tabular-nums ${
                    todayGold ? "text-[var(--ramp-gold-light)]" : ""
                  }`}
                >
                  {day.shortDate.split(" ")[1]}
                </span>
                {day.completed && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-[9px] text-white"
                    aria-label="Completed"
                  >
                    ✓
                  </span>
                )}
                {isToday && !day.completed && (
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--ramp-gold)]"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label="Next day"
        onClick={goNext}
        disabled={!canNext}
        className="day-wheel-spin day-wheel-spin--next shrink-0"
      >
        <span aria-hidden className="day-wheel-spin__glyph" />
      </button>
    </div>
  );
}