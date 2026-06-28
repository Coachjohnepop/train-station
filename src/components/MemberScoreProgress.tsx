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
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface-2)]/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          Score math
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:gap-4">
          <div>
            <p className="font-mono text-2xl font-black tabular-nums text-[var(--accent)]">
              {progress.earnedPoints}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Earned</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-black tabular-nums text-red-300/90">
              {progress.availablePoints}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Still available</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-black tabular-nums text-white/90">
              {progress.maxRampPoints}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Ramp max</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          {progress.earnedPoints} earned + {progress.availablePoints} on your ramp
          {progress.workoutLogs.nextPoints > 0 ? ` · workouts add +${progress.workoutLogs.nextPoints} each` : ""}
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