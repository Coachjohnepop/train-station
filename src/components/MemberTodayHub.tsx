import Link from "next/link";
import DayCompleteStamp from "@/components/DayCompleteStamp";
import MemberReminderSettings from "@/components/MemberReminderSettings";
import type { MemberDashboardData } from "@/lib/member-context";
import type { MaintainAccess } from "@/lib/member-maintain-workouts";

type Props = {
  dashboard: MemberDashboardData;
  /** Resolved maintain gate — greys out tile when locked. */
  maintainAccess?: MaintainAccess | null;
};

export default function MemberTodayHub({
  dashboard,
  maintainAccess = null,
}: Props) {
  const { enrollments, stats, trialEndsAt, effectivePlan } = dashboard;
  const dayComplete = Boolean(maintainAccess?.dayComplete);
  const maintainLocked = maintainAccess ? !maintainAccess.allowed : true;
  const maintainHref = maintainAccess
    ? "/member/today#quick-maintain"
    : "/member/account";

  return (
    <div className="space-y-3">
      {trialEndsAt ? (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          <span className="font-semibold text-accent">Free-week trial</span>
          {effectivePlan ? ` · ${effectivePlan}` : ""} until{" "}
          {new Date(trialEndsAt).toLocaleString()}.{" "}
          <Link href="/member/account" className="font-semibold text-accent underline">
            Keep access →
          </Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Link
          href="/member/chat"
          className="card flex items-center justify-between gap-2 p-3 transition hover-accent-border"
        >
          <div>
            <p className="text-sm font-semibold">Coach messages</p>
            <p className="text-[10px] text-[var(--muted)]">Text your coach</p>
          </div>
          <span className="text-xs font-medium text-accent">→</span>
        </Link>

        <Link
          href={maintainHref}
          className={`card relative flex items-center justify-between gap-2 overflow-hidden p-3 transition ${
            dayComplete
              ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]"
              : maintainLocked
                ? "opacity-60 grayscale-[0.4] hover:opacity-80"
                : "hover-accent-border"
          }`}
        >
          {dayComplete ? <DayCompleteStamp className="rounded-[inherit]" /> : null}
          <div className={dayComplete ? "relative z-[1] opacity-40" : undefined}>
            <p className="text-sm font-semibold">Maintain</p>
            <p className="text-[10px] text-[var(--muted)]">
              {dayComplete
                ? "Day complete"
                : maintainAccess?.mode === "full"
                  ? "Unlimited"
                  : maintainAccess?.mode === "earned" &&
                      maintainAccess.usesRemaining != null
                    ? `${maintainAccess.usesRemaining} left`
                    : maintainAccess
                      ? "Locked · earn or upgrade"
                      : "Business+"}
            </p>
          </div>
          <span
            className={`relative z-[1] text-xs font-medium ${
              dayComplete ? "text-[var(--success)]" : "text-accent"
            }`}
          >
            →
          </span>
        </Link>

        <Link
          href="/member/leaderboard"
          className="card flex items-center justify-around gap-2 p-3 transition hover-accent-border"
        >
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-accent">{stats.dayStreak}</p>
            <p className="text-[10px] text-[var(--muted)]">streak</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums">{stats.totalWorkouts}</p>
            <p className="text-[10px] text-[var(--muted)]">logged</p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            Scores →
          </span>
        </Link>

        <Link
          href="/member/account"
          className="card flex items-center justify-between gap-2 p-3 transition hover-accent-border"
        >
          <div>
            <p className="text-sm font-semibold">Account</p>
            <p className="text-[10px] text-[var(--muted)]">
              {enrollments[0]?.program.name ?? "Membership"}
            </p>
          </div>
          <span className="text-xs font-medium text-accent">→</span>
        </Link>
      </div>

      {enrollments.length > 0 && (
        <div className="card p-3">
          <MemberReminderSettings />
        </div>
      )}
    </div>
  );
}
