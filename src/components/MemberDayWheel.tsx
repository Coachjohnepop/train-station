"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MemberDaySummary } from "@/lib/member-day-window-types";

const CHIP_W = 76;
const GAP = 8;

type Props = {
  days: MemberDaySummary[];
  selectedIso: string;
  todayIso: string;
  onSelect: (iso: string) => void;
  /** Gold emphasis on today's chip during intake ramp-up */
  highlightTodayGold?: boolean;
};

export default function MemberDayWheel({
  days,
  selectedIso,
  todayIso,
  onSelect,
  highlightTodayGold = false,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScrolling = useRef(false);

  const scrollToIso = useCallback(
    (iso: string, smooth = true) => {
      const el = scroller.current;
      if (!el) return;
      const idx = days.findIndex((d) => d.iso === iso);
      if (idx < 0) return;
      const left = idx * (CHIP_W + GAP);
      el.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    },
    [days],
  );

  useEffect(() => {
    if (!userScrolling.current) scrollToIso(selectedIso, false);
  }, [selectedIso, scrollToIso]);

  function handleScroll() {
    const el = scroller.current;
    if (!el) return;
    userScrolling.current = true;
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollLeft / (CHIP_W + GAP));
      const clamped = Math.max(0, Math.min(days.length - 1, idx));
      const targetLeft = clamped * (CHIP_W + GAP);
      el.scrollLeft = targetLeft;
      const next = days[clamped]?.iso;
      if (next && next !== selectedIso) onSelect(next);
      userScrolling.current = false;
    }, 90);
  }

  if (!days.length) return null;

  return (
    <div className="relative -mx-1">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[76px] -translate-x-1/2 rounded-xl border ${
          highlightTodayGold && selectedIso === todayIso
            ? "day-wheel-focus-gold"
            : "border-[var(--accent)]/40 bg-[var(--accent)]/6"
        }`}
      />
      <div
        ref={scroller}
        role="listbox"
        aria-label="Workout days"
        className="day-wheel no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-[calc(50%-38px)] py-2"
        style={{ scrollSnapType: "x mandatory" }}
        onScroll={handleScroll}
      >
        {days.map((day) => {
          const isSelected = day.iso === selectedIso;
          const isToday = day.iso === todayIso;
          const todayGold = highlightTodayGold && isToday;
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
              className={`relative flex w-[76px] shrink-0 snap-center flex-col items-center rounded-xl border px-1 py-2.5 text-center transition ${chipClass}`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  todayGold ? "text-[var(--ramp-gold-light)]" : isToday ? "text-accent" : "text-[var(--muted)]"
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
                  className={`mt-1 h-1.5 w-1.5 rounded-full ${todayGold ? "bg-[var(--ramp-gold)]" : "bg-accent"}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}