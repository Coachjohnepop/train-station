"use client";

import {
  blockEndDateFromStart,
  formatProgramStartOption,
  isWeekendIso,
  orderedProgramStartDateOptions,
  programStartPickerOptions,
  recommendedProgramStartDate,
  weekdayIndexFromIso,
} from "@/lib/member-program-block";
import { localTodayIso } from "@/lib/program-calendar";
import {
  PROGRAM_START_WEEKDAYS,
  type ProgramStartSettings,
  weekdayLabel,
} from "@/lib/program-start-settings";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  todayIso?: string;
  settings?: Partial<ProgramStartSettings>;
};

function optionSubtitle(
  iso: string,
  today: string,
  recommended: boolean,
  recommendWeekday: number | null,
  blockDays: number,
): string {
  if (recommended && recommendWeekday != null) {
    const day = weekdayLabel(recommendWeekday);
    if (recommendWeekday === 1) {
      return `Recommended — Day 1 on ${day} (best if you train weekends)`;
    }
    return `Recommended — Day 1 on ${day}`;
  }
  if (iso === today) return "Start today — Day 1";
  if (
    recommendWeekday === 1 &&
    isWeekendIso(iso) &&
    weekdayIndexFromIso(iso) !== recommendWeekday
  ) {
    return "Weekend start — Monday is usually a better fit";
  }
  return "Schedule Day 1";
}

export default function ProgramStartDatePicker({
  value,
  onChange,
  todayIso,
  settings,
}: Props) {
  const today = todayIso || localTodayIso();
  const pickerOpts = programStartPickerOptions(settings);
  const blockDays = settings?.blockDays ?? 28;
  const options = orderedProgramStartDateOptions(today, pickerOpts);
  const recommended = recommendedProgramStartDate(today, pickerOpts);
  const showWeekdayNudge =
    pickerOpts.recommendWeekday != null &&
    value !== recommended &&
    weekdayIndexFromIso(value) !== pickerOpts.recommendWeekday;

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
              {optionSubtitle(
                iso,
                today,
                isRec,
                pickerOpts.recommendWeekday,
                blockDays,
              )}
            </span>
          </button>
        );
      })}
      {showWeekdayNudge && pickerOpts.recommendWeekday != null && (
        <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[10px] text-[var(--success)]/90">
          Tip: Starting on{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
            onClick={() => onChange(recommended)}
          >
            {formatProgramStartOption(recommended)}
          </button>{" "}
          lines Day 1 up with the week
          {pickerOpts.recommendWeekday === 1 ? " — handy if Saturday/Sunday are your gym days" : ""}.
        </p>
      )}
      {value && (
        <p className="text-[10px] text-[var(--muted)]">
          {blockDays} days: {formatProgramStartOption(value)} →{" "}
          {formatProgramStartOption(blockEndDateFromStart(value, blockDays))}
        </p>
      )}
    </div>
  );
}

export { PROGRAM_START_WEEKDAYS };