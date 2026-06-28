import Link from "next/link";
import MemberReminderSettings from "@/components/MemberReminderSettings";
import type { MemberDashboardData } from "@/lib/member-context";

type Props = {
  dashboard: MemberDashboardData;
};

export default function MemberTodayHub({ dashboard }: Props) {
  const { enrollments, stats } = dashboard;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">Scores →</span>
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