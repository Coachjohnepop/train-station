"use client";

import {
  allowedProgramStartDates,
  blockEndDateFromStart,
  formatProgramStartOption,
} from "@/lib/member-program-block";
import { localTodayIso } from "@/lib/program-calendar";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  todayIso?: string;
};

export default function ProgramStartDatePicker({ value, onChange, todayIso }: Props) {
  const today = todayIso || localTodayIso();
  const options = allowedProgramStartDates(today);

  return (
    <div className="space-y-2">
      {options.map((iso) => {
        const selected = value === iso;
        const isToday = iso === today;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onChange(iso)}
            className={
              selected
                ? "w-full rounded-xl border-2 border-[#7c3aed] bg-[#7c3aed]/15 px-4 py-3 text-left transition"
                : "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[#7c3aed]/40"
            }
          >
            <span className="block text-sm font-semibold">{formatProgramStartOption(iso)}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
              {isToday ? "Start today — Day 1" : "Schedule Day 1"}
            </span>
          </button>
        );
      })}
      {value && (
        <p className="text-[10px] text-[var(--muted)]">
          28 days: {formatProgramStartOption(value)} →{" "}
          {formatProgramStartOption(blockEndDateFromStart(value))}
        </p>
      )}
    </div>
  );
}