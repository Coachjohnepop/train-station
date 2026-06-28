"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MemberDayWheel from "@/components/MemberDayWheel";
import MemberIntakeIntroCard from "@/components/MemberIntakeIntroCard";
import MemberWarmupDayNavigator from "@/components/MemberWarmupDayNavigator";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";

type Props = {
  todayIso: string;
  selectedDate: string;
  days: MemberDaySummary[];
  rollup: MemberDayWindowRollup | null;
  selectedSummary: MemberDaySummary | null;
  nextStretchPreview: string[];
  workout: MemberWorkoutView | null;
  programSlug: string;
  targetUserId: string;
  scheduleLabel?: string;
  calendarDateLabel: string;
  subtitle: string;
  hasCoachSession: boolean;
  intakeComplete: boolean;
  warmupWorkout: MemberWorkoutView | null;
};

function DaySummaryCard({
  summary,
  isToday,
}: {
  summary: MemberDaySummary;
  isToday: boolean;
}) {
  const {
    phase,
    workoutName,
    completed,
    exerciseCount,
    exerciseNames,
    smsOverride,
    dayLabel,
    visibilityTier,
    themeLabel,
  } = summary;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {phase === "past" ? "What you did" : phase === "future" ? "Coming up" : "Today"}
            <span className="mx-1">·</span>
            {dayLabel}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight">
            {workoutName || "No session scheduled"}
          </h2>
        </div>
        {completed && (
          <span className="shrink-0 rounded-full bg-[var(--success)]/15 px-2 py-1 text-[10px] font-semibold text-[var(--success)]">
            Done ✓
          </span>
        )}
      </div>

      {smsOverride && (
        <p className="text-xs text-amber-300">Coach assigned a custom workout for this day.</p>
      )}

      {phase === "past" && exerciseNames.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Movements logged
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-[var(--muted)]">
            {exerciseNames.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "future" && visibilityTier === "label" && (themeLabel || workoutName) && (
        <p className="text-sm text-[var(--muted)]">
          Preview only — full exercises and sets unlock closer to the day.
        </p>
      )}

      {phase === "future" && visibilityTier === "names" && exerciseNames.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Exercises (sets unlock day-of)
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-[var(--muted)]">
            {exerciseNames.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "future" && visibilityTier === "names" && exerciseNames.length === 0 && exerciseCount > 0 && (
        <p className="text-sm text-[var(--muted)]">
          {exerciseCount} movement{exerciseCount === 1 ? "" : "s"} — sets unlock on this day.
        </p>
      )}

      {!isToday && phase !== "past" && (
        <p className="text-xs text-[var(--muted)]">
          Spin back to <span className="text-accent font-medium">today</span> to see your full
          workout and check off sets.
        </p>
      )}

      {isToday && !workoutName && (
        <p className="text-sm text-[var(--muted)]">
          No program workout today — check coach messages for assignments.
        </p>
      )}
    </div>
  );
}

export default function MemberTodayShell({
  todayIso,
  selectedDate,
  days,
  rollup,
  selectedSummary,
  nextStretchPreview,
  workout,
  programSlug,
  targetUserId,
  scheduleLabel,
  calendarDateLabel,
  subtitle,
  hasCoachSession,
  intakeComplete,
  warmupWorkout,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isToday = selectedDate === todayIso;
  const showFullWorkout = isToday && !!workout && intakeComplete;
  const showWarmupFlow = !intakeComplete && !!warmupWorkout && days.length > 0;

  function selectDate(iso: string) {
    const q = new URLSearchParams(searchParams.toString());
    if (iso === todayIso) q.delete("date");
    else q.set("date", iso);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    router.replace(`/member/today${suffix}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{isToday ? "Today" : "Your schedule"}</h1>
        <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">{subtitle}</p>
      </div>

      {rollup && days.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 text-center text-[11px] text-[var(--muted)]">
          <span>
            <strong className="text-[var(--text)]">{rollup.pastDone}</strong>/{rollup.pastTotal}{" "}
            done
          </span>
          <span className="text-[var(--border)]">|</span>
          <span className="text-accent font-medium">Today</span>
          <span className="text-[var(--border)]">|</span>
          <span>
            <strong className="text-[var(--text)]">{rollup.futureTotal}</strong> ahead
          </span>
        </div>
      )}

      {days.length > 0 && (
        <MemberDayWheel
          days={days}
          selectedIso={selectedDate}
          todayIso={todayIso}
          onSelect={selectDate}
        />
      )}

      {!showWarmupFlow && !isToday && selectedSummary && (
        <DaySummaryCard summary={selectedSummary} isToday={false} />
      )}

      {showWarmupFlow && (
        <>
          {isToday && <MemberIntakeIntroCard />}
          <MemberWarmupDayNavigator
            days={days}
            todayIso={todayIso}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            warmupWorkout={warmupWorkout}
            programSlug={programSlug}
            targetUserId={targetUserId}
          />
        </>
      )}

      {!showWarmupFlow && isToday && !showFullWorkout && selectedSummary && (
        <DaySummaryCard summary={selectedSummary} isToday />
      )}

      {showFullWorkout && workout && (
        <div className="-mx-4 sm:mx-0">
          <MemberWorkoutConsole
            workout={workout}
            backHref="/member/today"
            programSlug={programSlug}
            targetUserId={targetUserId}
            liveSyncUserId={targetUserId}
            liveSessionDate={selectedDate}
            scheduleLabel={scheduleLabel}
            calendarDateLabel={calendarDateLabel}
          />
        </div>
      )}

      {isToday && nextStretchPreview.length > 0 && (
        <div className="card border-dashed border-[var(--accent)]/25 bg-[var(--accent)]/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            Tomorrow — stretch preview
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Plan ahead for mobility (full workout unlocks tomorrow):
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nextStretchPreview.map((name) => (
              <li
                key={name}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isToday && !showFullWorkout && !hasCoachSession && (
        <div className="card p-3 text-sm text-[var(--muted)]">
          <p>Your coach can assign a workout via SMS — it will show here on the day.</p>
          <Link href="/member/chat" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            Message your coach →
          </Link>
        </div>
      )}

      {selectedDate !== todayIso && (
        <button
          type="button"
          onClick={() => selectDate(todayIso)}
          className="w-full rounded-full border border-accent/40 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
        >
          Jump to today
        </button>
      )}
    </div>
  );
}