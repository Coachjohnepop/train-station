"use client";

import Link from "next/link";
import { addDaysIso } from "@/lib/workout-day-visibility";

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

function dayHref(iso: string, calendarToday: string): string {
  return iso === calendarToday ? "/admin/day" : `/admin/day?date=${iso}`;
}

export default function CoachClassDayBand({
  sessionDate,
  calendarToday,
}: {
  sessionDate: string;
  calendarToday: string;
}) {
  const quickSlots: DaySlot[] = [
    { iso: calendarToday, label: "Today" },
    { iso: addDaysIso(calendarToday, 1), label: "Tomorrow" },
    { iso: addDaysIso(calendarToday, 2), label: "Next day" },
  ];

  const prevIso = addDaysIso(sessionDate, -1);
  const nextIso = addDaysIso(sessionDate, 1);

  return (
    <div className="coach-class-day-band" role="navigation" aria-label="Class day">
      <Link
        href={dayHref(prevIso, calendarToday)}
        className="coach-day-cell coach-day-cell--nav"
        aria-label="Previous day"
      >
        ‹
      </Link>
      {quickSlots.map((slot) => {
        const meta = dayMeta(slot.iso);
        const active = sessionDate === slot.iso;
        return (
          <Link
            key={slot.iso}
            href={dayHref(slot.iso, calendarToday)}
            className={`coach-day-cell ${active ? "coach-day-cell--active" : ""}`}
            aria-current={active ? "date" : undefined}
            title={slot.label}
          >
            <span className="coach-day-cell__num">{meta.dayNum}</span>
            <span className="coach-day-cell__wd">{meta.weekday}</span>
            <span className="coach-day-cell__lbl">{slot.label}</span>
          </Link>
        );
      })}
      <Link
        href={dayHref(nextIso, calendarToday)}
        className="coach-day-cell coach-day-cell--nav"
        aria-label="Next day"
      >
        ›
      </Link>
    </div>
  );
}