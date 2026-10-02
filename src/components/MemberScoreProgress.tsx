"use client";

import Link from "next/link";
import type { MemberScoreProgress, ScoreMilestone } from "@/lib/gamification-types";

function MilestoneCard({ milestone }: { milestone: ScoreMilestone }) {
  const incomplete = milestone.status === "incomplete";
  const showStamp = incomplete && (!milestone.repeatable || milestone.earnedPoints === 0);
  const displayPoints = milestone.repeatable
    ? `+${milestone.points}`
    : incomplete
      ? `+${milestone.points}`
      : milestone.earnedPoints;

  const inner = (
    <div
      className={`score-milestone-card relative overflow-hidden rounded-xl border p-3 transition ${
        incomplete
          ? "border-red-500/25 bg-[var(--surface)]/40"
          : "border-[var(--accent)]/35 bg-[var(--accent)]/10"
      }`}
    >
      {showStamp ? (
        <div className="score-milestone-stamp pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span>Incomplete</span>
        </div>
      ) : null}

      <div className={showStamp ? "opacity-55" : ""}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
          {milestone.repeatable ? "Repeatable" : incomplete ? "Up next" : "Done"}
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">{milestone.label}</p>
        <p
          className={`mt-2 font-mono text-2xl font-black tabular-nums ${
            incomplete ? "text-red-300/90" : "text-[var(--accent)]"
          }`}
        >
          {displayPoints}
          <span className="ml-1 text-xs font-semibold text-[var(--muted)]">pts</span>
        </p>
        {milestone.repeatable && milestone.earnedPoints > 0 ? (
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            {milestone.earnedPoints} earned so far · next log +{milestone.points}
          </p>
        ) : null}
        {milestone.earnHint ? (
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">{milestone.earnHint}</p>
        ) : null}
      </div>
    </div>
  );

  if (incomplete && milestone.href) {
    return (
      <Link href={milestone.href} className="block hover:scale-[1.01] active:scale-[0.99]">
        {inner}
      </Link>
    );
  }

  return inner;
}

export default function MemberScoreProgressPanel({ progress }: { progress: MemberScoreProgress }) {
  const goal = Math.max(1, progress.cycleGoal || 2000);
  const pct = Math.min(100, Math.round((progress.earnedPoints / goal) * 100));
  const ends = progress.seasonEndsAt
    ? new Date(progress.seasonEndsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface-2)]/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          {progress.seasonDays || 28}-day cycle
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-3xl font-black tabular-nums text-[var(--accent)]">
              {progress.earnedPoints.toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">This cycle</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-black tabular-nums text-white/90">
              {goal.toLocaleString()}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Goal</p>
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]"
          role="progressbar"
          aria-valuenow={progress.earnedPoints}
          aria-valuemin={0}
          aria-valuemax={goal}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          {pct}% of {goal.toLocaleString()}
          {ends ? ` · resets ${ends}` : ""}
          {progress.workoutLogs.nextPoints > 0
            ? ` · each workout +${progress.workoutLogs.nextPoints}`
            : ""}
        </p>
        <p className="mt-1 text-center text-[10px] text-[var(--muted)]">
          {goal >= 1000
            ? "Coach Class, Business Class, and 1st Class earn the same. 3 workouts a week (set + log) is the 2,000-point cycle. Stretching, first workout, booking, and measurements add extra."
            : "3 workouts a week (set + log) fills this 28-day cycle. Stretching, first workout, booking, and measurements add extra."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {progress.milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </div>
    </section>
  );
}