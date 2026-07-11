"use client";

import {
  blockEndDateFromStart,
  formatProgramStartOption,
  isMondayIso,
  isWeekendIso,
  orderedProgramStartDateOptions,
  recommendedProgramStartDate,
} from "@/lib/member-program-block";
import { localTodayIso } from "@/lib/program-calendar";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  todayIso?: string;
};

function optionSubtitle(iso: string, today: string, recommended: boolean): string {
  if (recommended && isMondayIso(iso)) {
    return "Recommended — Day 1 on Monday (best if you train weekends)";
  }
  if (iso === today) return "Start today — Day 1";
  if (isWeekendIso(iso)) return "Weekend start — Monday is usually a better fit";
  return "Schedule Day 1";
}

export default function ProgramStartDatePicker({ value, onChange, todayIso }: Props) {
  const today = todayIso || localTodayIso();
  const options = orderedProgramStartDateOptions(today);
  const recommended = recommendedProgramStartDate(today);
  const showMondayNudge = value !== recommended && isWeekendIso(value);

  return (
    <div className="space-y-2">
      {options.map(({ iso, recommended: isRec }) => {
        const selected = value === iso;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onChange(iso)}
            className={
              selected
                ? isRec
                  ? "w-full rounded-xl border-2 border-emerald-500/70 bg-emerald-500/10 px-4 py-3 text-left transition ring-1 ring-emerald-400/30"
                  : "w-full rounded-xl border-2 border-[#7c3aed] bg-[#7c3aed]/15 px-4 py-3 text-left transition"
                : isRec
                  ? "w-full rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-left transition hover:border-emerald-400/60"
                  : "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[#7c3aed]/40"
            }
          >
            <div className="flex items-start justify-between gap-2">
              <span className="block text-sm font-semibold">{formatProgramStartOption(iso)}</span>
              {isRec && (
                <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                  Recommended
                </span>
              )}
            </div>
            <span
              className={`mt-0.5 block text-[10px] ${isRec ? "text-emerald-200/80" : "text-[var(--muted)]"}`}
            >
              {optionSubtitle(iso, today, isRec)}
            </span>
          </button>
        );
      })}
      {showMondayNudge && (
        <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[10px] text-emerald-100/90">
          Tip: Starting on{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2 hover:text-white"
            onClick={() => onChange(recommended)}
          >
            {formatProgramStartOption(recommended)}
          </button>{" "}
          lines Day 1 up with the week — handy if Saturday/Sunday are your gym days.
        </p>
      )}
      {value && (
        <p className="text-[10px] text-[var(--muted)]">
          28 days: {formatProgramStartOption(value)} →{" "}
          {formatProgramStartOption(blockEndDateFromStart(value))}
        </p>
      )}
    </div>
  );
}