"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MEMBER_TODAY_RESET_EVENT } from "@/lib/member-today-home";
import MemberDayWheel from "@/components/MemberDayWheel";
import MemberIntakeIntroCard from "@/components/MemberIntakeIntroCard";
import MemberWarmupDayNavigator from "@/components/MemberWarmupDayNavigator";
import MemberTrainingLocationToggle from "@/components/MemberTrainingLocationToggle";
import MemberWorkoutConsole, { type MemberWorkoutView } from "@/components/MemberWorkoutConsole";
import type { MemberDaySummary, MemberDayWindowRollup } from "@/lib/member-day-window-types";
import { scheduleDayHeadline } from "@/lib/workout-day-visibility";
import {
  formatProgramStartOption,
  type ResolvedProgramBlock,
} from "@/lib/member-program-block";

type Props = {
  todayIso: string;
  selectedDate: string;
  days: MemberDaySummary[];
  rollup: MemberDayWindowRollup | null;
  selectedSummary: MemberDaySummary | null;
  nextStretchPreview: string[];
  tomorrowDay?: MemberDaySummary | null;
  workout: MemberWorkoutView | null;
  programSlug: string;
  trainingLocation?: "gym" | "home";
  targetUserId: string;
  scheduleLabel?: string;
  calendarDateLabel: string;
  subtitle: string;
  hasCoachSession: boolean;
  intakeComplete: boolean;
  warmupWorkout: MemberWorkoutView | null;
  introBookedAt?: string | null;
  coachMeetingRequestedAt?: string | null;
  coachMeetingRequestNote?: string | null;
  autoPromptIntroBooking?: boolean;
  autoPromptFollowUpBooking?: boolean;
  programBlock?: ResolvedProgramBlock | null;
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
            {scheduleDayHeadline(workoutName, dayLabel, { phase, visibilityTier })}
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

      {phase === "future" && visibilityTier === "label" && (
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
  tomorrowDay = null,
  workout,
  programSlug,
  trainingLocation = "gym",
  targetUserId,
  scheduleLabel,
  calendarDateLabel,
  subtitle,
  hasCoachSession,
  intakeComplete,
  warmupWorkout,
  introBookedAt = null,
  coachMeetingRequestedAt = null,
  coachMeetingRequestNote = null,
  autoPromptIntroBooking = false,
  autoPromptFollowUpBooking = false,
  programBlock = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isToday = selectedDate === todayIso;
  const showFullWorkout = isToday && !!workout && (intakeComplete || hasCoachSession);
  const showWarmupFlow =
    !intakeComplete && !!warmupWorkout && days.length > 0 && !hasCoachSession;

  const selectDate = useCallback(
    (iso: string) => {
      const q = new URLSearchParams(searchParams.toString());
      if (iso === todayIso) q.delete("date");
      else q.set("date", iso);
      const suffix = q.toString() ? `?${q.toString()}` : "";
      router.replace(`/member/today${suffix}`, { scroll: false });
    },
    [router, searchParams, todayIso],
  );

  useEffect(() => {
    function onTodayReset() {
      selectDate(todayIso);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener(MEMBER_TODAY_RESET_EVENT, onTodayReset);
    return () => window.removeEventListener(MEMBER_TODAY_RESET_EVENT, onTodayReset);
  }, [selectDate, todayIso]);

  const rampHighlight = showWarmupFlow && !intakeComplete;
  const todayGold = isToday;
  const showFollowUpCard =
    autoPromptFollowUpBooking && isToday && !!coachMeetingRequestedAt && intakeComplete;
  const showIntroCard = autoPromptIntroBooking && isToday;

  const intakeStatus = {
    introBookedAt,
    coachMeetingRequestedAt,
    coachMeetingRequestNote,
  };

  return (
    <div
      id="member-today-top"
      className={`scroll-mt-4 min-w-0 space-y-4 overflow-x-clip ${todayGold ? "member-today-gold-shell" : ""}`}
    >
      {programBlock?.status === "pending" && (
        <div className="rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 py-3 text-sm">
          <p className="font-semibold text-[#e9d5ff]">Program starts soon</p>
          <p className="mt-1 text-[var(--muted)]">
            Day 1 is {formatProgramStartOption(programBlock.programStartDate)}
            {programBlock.daysUntilStart === 1
              ? " — tomorrow."
              : programBlock.daysUntilStart > 1
                ? ` — in ${programBlock.daysUntilStart} days.`
                : "."}
            {" "}Your full 28-day calendar is below; workouts unlock on start day.
          </p>
        </div>
      )}

      {programBlock?.status === "expired" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-200">28-day block complete</p>
          <p className="mt-1 text-[var(--muted)]">
            Your access ended {formatProgramStartOption(programBlock.blockEndsAt)}. Renew your
            membership to start the next block.
          </p>
          <Link href="/member/account" className="mt-2 inline-block text-xs text-accent hover:underline">
            Account & billing →
          </Link>
        </div>
      )}

      <div>
        <h1
          className={`text-xl font-bold sm:text-2xl ${todayGold ? "text-ramp-gold" : ""}`}
        >
          {isToday
            ? programBlock?.status === "pending"
              ? "Before Day 1"
              : "Today"
            : "Your schedule"}
        </h1>
        {isToday && rampHighlight && autoPromptIntroBooking ? (
          <p className="mt-1 text-xs font-medium text-[var(--ramp-gold-light)] sm:text-sm">
            Start here — book your intro, then warm up below.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">{subtitle}</p>
        )}
      </div>

      {rollup && days.length > 0 && (
        <div
          className={`flex flex-wrap items-center justify-center gap-3 rounded-xl border px-3 py-2 text-center text-[11px] text-[var(--muted)] ${
            todayGold
              ? "border-[color-mix(in_srgb,var(--ramp-gold)_40%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_8%,var(--surface))]"
              : "border-[var(--border)] bg-[var(--surface)]/60"
          }`}
        >
          <span>
            <strong className="text-[var(--text)]">{rollup.pastDone}</strong>/{rollup.pastTotal}{" "}
            done
          </span>
          <span className="text-[var(--border)]">|</span>
          <span className={`font-semibold ${todayGold ? "text-ramp-gold" : "text-accent font-medium"}`}>
            Today
          </span>
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
          highlightTodayGold={todayGold}
        />
      )}

      {!showWarmupFlow && !isToday && selectedSummary && (
        <DaySummaryCard summary={selectedSummary} isToday={false} />
      )}

      {showFollowUpCard && (
        <MemberIntakeIntroCard initialStatus={intakeStatus} followUpOnly />
      )}

      {showIntroCard && !intakeComplete && !showFollowUpCard && !showWarmupFlow && (
        <MemberIntakeIntroCard initialStatus={intakeStatus} />
      )}

      {showWarmupFlow && (
        <>
          {showIntroCard && <MemberIntakeIntroCard initialStatus={intakeStatus} />}
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
        <div className="min-w-0 sm:mx-0">
          {programSlug === "adult" && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-xs text-[var(--muted)]">Today&apos;s track</span>
              <MemberTrainingLocationToggle
                programSlug={programSlug}
                initialLocation={trainingLocation}
              />
            </div>
          )}
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

      {isToday && tomorrowDay && (
        <div className="card border-dashed border-[color-mix(in_srgb,var(--ramp-gold)_35%,var(--border))] bg-[color-mix(in_srgb,var(--ramp-gold)_6%,var(--surface))] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ramp-gold-light)]">
            Tomorrow —{" "}
            {scheduleDayHeadline(tomorrowDay.workoutName, tomorrowDay.dayLabel, {
              phase: "future",
              visibilityTier: tomorrowDay.visibilityTier,
            })}
          </p>
          {tomorrowDay.visibilityTier === "names" && tomorrowDay.exerciseNames.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Exercise preview (sets unlock tomorrow):
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {tomorrowDay.exerciseNames.slice(0, 6).map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
                {tomorrowDay.exerciseNames.length > 6 && (
                  <li className="text-xs">+{tomorrowDay.exerciseNames.length - 6} more</li>
                )}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Full workout details unlock closer to the day.
            </p>
          )}
          {nextStretchPreview.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Stretch preview
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {nextStretchPreview.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {isToday && hasCoachSession && !workout && (
        <div className="card border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p>Your coach assigned today&apos;s workout — it&apos;s still loading. Pull to refresh or wait a few seconds.</p>
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
          className="w-full rounded-full border border-[color-mix(in_srgb,var(--ramp-gold)_45%,transparent)] py-2.5 text-sm font-semibold text-[var(--ramp-gold-light)] transition hover:bg-[color-mix(in_srgb,var(--ramp-gold)_12%,transparent)]"
        >
          Jump to today
        </button>
      )}
    </div>
  );
}