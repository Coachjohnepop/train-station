"use client";

import Link from "next/link";
import { addDaysIso } from "@/lib/workout-day-visibility";
import type { CoachDaySummary } from "@/lib/coach-day";

type DaySlot = {
  iso: string;
  label: string;
};

function dayMeta(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dayNum: d.getDate(),
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
}

function dayHref(iso: string, calendarToday: string, planOpen: boolean): string {
  const params = new URLSearchParams();
  if (iso !== calendarToday) params.set("date", iso);
  if (planOpen) params.set("plan", "1");
  const qs = params.toString();
  return qs ? `/admin/day?${qs}` : "/admin/day";
}

export default function CoachClassDayBand({
  sessionDate,
  calendarToday,
  daySummaries = {},
  planOpen = false,
  onSelectDate,
}: {
  sessionDate: string;
  calendarToday: string;
  daySummaries?: Record<string, CoachDaySummary>;
  planOpen?: boolean;
  /** When set (plan open), chips retarget the draft instead of navigating away. */
  onSelectDate?: (iso: string) => void;
}) {
  const quickSlots: DaySlot[] = (() => {
    const base: DaySlot[] = [
      { iso: calendarToday, label: "Today" },
      { iso: addDaysIso(calendarToday, 1), label: "Tomorrow" },
      { iso: addDaysIso(calendarToday, 2), label: "Next" },
    ];
    if (base.some((s) => s.iso === sessionDate)) return base;
    const weekday = new Date(`${sessionDate}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
    });
    return [{ iso: sessionDate, label: weekday }, ...base].slice(0, 3);
  })();

  const prevIso = addDaysIso(sessionDate, -1);
  const nextIso = addDaysIso(sessionDate, 1);

  function cellTitle(iso: string, slotLabel: string): string {
    const summary = daySummaries[iso];
    if (!summary?.hasWorkout) return `${slotLabel} — no workout yet`;
    const title = summary.title ? ` · ${summary.title}` : "";
    return `${slotLabel}${title} · ${summary.assignedCount} assigned`;
  }

  const navClass = "coach-day-cell coach-day-cell--nav";

  return (
    <div className="coach-class-day-band" role="navigation" aria-label="Class day">
      {onSelectDate ? (
        <button type="button" className={navClass} aria-label="Previous day" onClick={() => onSelectDate(prevIso)}>
          ‹
        </button>
      ) : (
        <Link href={dayHref(prevIso, calendarToday, planOpen)} className={navClass} aria-label="Previous day">
          ‹
        </Link>
      )}
      {quickSlots.map((slot) => {
        const meta = dayMeta(slot.iso);
        const active = sessionDate === slot.iso;
        const summary = daySummaries[slot.iso];
        const planned = summary?.hasWorkout;
        const cellClass = `coach-day-cell ${active ? "coach-day-cell--active" : ""} ${
          planned ? "coach-day-cell--planned" : ""
        }`;
        const inner = (
          <>
            <span className="coach-day-cell__num">{meta.dayNum}</span>
            <span className="coach-day-cell__wd">{meta.weekday}</span>
            <span className="coach-day-cell__lbl">{slot.label}</span>
            {planned ? (
              <span className="coach-day-cell__planned" aria-hidden>
                ✓
              </span>
            ) : null}
          </>
        );
        if (onSelectDate) {
          return (
            <button
              key={slot.iso}
              type="button"
              className={cellClass}
              aria-current={active ? "date" : undefined}
              title={cellTitle(slot.iso, slot.label)}
              onClick={() => onSelectDate(slot.iso)}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={slot.iso}
            href={dayHref(slot.iso, calendarToday, planOpen)}
            className={cellClass}
            aria-current={active ? "date" : undefined}
            title={cellTitle(slot.iso, slot.label)}
          >
            {inner}
          </Link>
        );
      })}
      {onSelectDate ? (
        <button type="button" className={navClass} aria-label="Next day" onClick={() => onSelectDate(nextIso)}>
          ›
        </button>
      ) : (
        <Link href={dayHref(nextIso, calendarToday, planOpen)} className={navClass} aria-label="Next day">
          ›
        </Link>
      )}
    </div>
  );
}