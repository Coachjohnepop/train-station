"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MemberDaySummary } from "@/lib/member-day-window-types";

const MAX_CHIP_W = 76;
const MIN_CHIP_W = 48;
const GAP_DESKTOP = 8;
const GAP_MOBILE = 4;
const VISIBLE_DAYS = 5;

type WheelMetrics = {
  chipW: number;
  gap: number;
  step: number;
};

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

function gapForViewport(): number {
  if (typeof window === "undefined") return GAP_DESKTOP;
  return window.matchMedia("(min-width: 640px)").matches ? GAP_DESKTOP : GAP_MOBILE;
}

function chipWidthForViewport(viewportPx: number, visibleCount: number, gap: number): number {
  if (visibleCount <= 0 || viewportPx <= 0) return MAX_CHIP_W;
  const raw = (viewportPx - (visibleCount - 1) * gap) / visibleCount;
  return Math.min(MAX_CHIP_W, Math.max(MIN_CHIP_W, Math.floor(raw)));
}

export default function MemberDayWheel({
  days,
  selectedIso,
  todayIso,
  onSelect,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<WheelMetrics>({
    chipW: MAX_CHIP_W,
    gap: GAP_DESKTOP,
    step: MAX_CHIP_W + GAP_DESKTOP,
  });

  const selectedIdx = days.findIndex((d) => d.iso === selectedIso);
  const currentIdx = selectedIdx >= 0 ? selectedIdx : days.findIndex((d) => d.iso === todayIso);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < days.length - 1;
  const visibleCount = Math.min(VISIBLE_DAYS, days.length);

  const startIdx = useMemo(
    () => windowStartIndex(days, currentIdx >= 0 ? currentIdx : 0),
    [days, currentIdx],
  );

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || visibleCount <= 0) return;

    const measure = () => {
      const gap = gapForViewport();
      const chipW = chipWidthForViewport(el.clientWidth, visibleCount, gap);
      setMetrics({ chipW, gap, step: chipW + gap });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const mq = window.matchMedia("(min-width: 640px)");
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", measure);
    };
  }, [visibleCount]);

  const goPrev = useCallback(() => {
    if (!canPrev || currentIdx < 0) return;
    onSelect(days[currentIdx - 1].iso);
  }, [canPrev, currentIdx, days, onSelect]);

  const goNext = useCallback(() => {
    if (!canNext || currentIdx < 0) return;
    onSelect(days[currentIdx + 1].iso);
  }, [canNext, currentIdx, days, onSelect]);

  if (!days.length) return null;

  const compactChip = metrics.chipW < 58;
  const allDaysVisible = days.length <= VISIBLE_DAYS;

  return (
    <div className="day-wheel-shell mx-auto flex w-full min-w-0 max-w-full items-center justify-center gap-1 sm:gap-2">
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
        ref={viewportRef}
        role="listbox"
        aria-label="Workout days"
        className={`day-wheel-viewport min-w-0 flex-1 py-2 ${allDaysVisible ? "day-wheel-viewport--centered" : ""}`}
      >
        <div
          className="day-wheel-strip"
          style={{
            gap: metrics.gap,
            transform: allDaysVisible ? undefined : `translate3d(-${startIdx * metrics.step}px, 0, 0)`,
          }}
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
                style={{ width: metrics.chipW, flexShrink: 0 }}
                className={`relative flex flex-col items-center rounded-xl border px-0.5 py-2 text-center transition-colors duration-200 sm:px-1 sm:py-2.5 ${chipClass} ${
                  compactChip ? "day-wheel-chip--compact" : ""
                }`}
              >
                <span
                  className={`font-semibold uppercase tracking-wide ${
                    compactChip ? "text-[9px]" : "text-[10px]"
                  } ${todayGold ? "text-[var(--ramp-gold-light)]" : "text-[var(--muted)]"}`}
                >
                  {day.weekday}
                </span>
                <span
                  className={`mt-0.5 font-bold tabular-nums ${
                    compactChip ? "text-xs" : "text-sm"
                  } ${todayGold ? "text-[var(--ramp-gold-light)]" : ""}`}
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