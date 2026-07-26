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

function maintainTileSubtitle(access: MaintainAccess | null, dayComplete: boolean): string {
  if (!access) return "5 uses / month";
  if (dayComplete) return "Day complete";
  if (access.mode === "full") {
    if (access.usesRemaining != null && access.usesLimit != null) {
      return `${access.usesRemaining} of ${access.usesLimit} left`;
    }
    return "5 uses / month";
  }
  if (access.mode === "earned" && access.usesRemaining != null) {
    return `${access.usesRemaining} left this month`;
  }
  if (access.mode === "locked") {
    if (access.earnReady && access.usesRemaining === 0) {
      return "0 of 5 left";
    }
    if (!access.showUpsMet) {
      return `Earn · ${access.showUps}/${access.showUpsNeeded} show-ups`;
    }
    if (!access.onDemandDone) return "Earn · finish on-demand";
    return "Locked · earn or upgrade";
  }
  return "Locked · earn or upgrade";
}

/** Short hover / long-press friendly copy for locked Coach Class. */
function maintainTileTitle(access: MaintainAccess | null, dayComplete: boolean): string {
  if (dayComplete) {
    return "You already trained today — Quick maintain opens again tomorrow.";
  }
  if (!access) return "Quick maintain — Business Class: five uses per month.";
  if (access.allowed) {
    return access.detail || access.headline;
  }
  return (
    access.detail ||
    `Coach Class: log ${access.showUpsNeeded} workouts this month (${access.showUps}/${access.showUpsNeeded}) and finish on-demand content for ${access.usesLimit ?? 5} Quick maintain uses — or upgrade to Business Class for five uses per month included.`
  );
}

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
  const maintainTitle = maintainTileTitle(maintainAccess, dayComplete);

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
      {/* Primary tools first; Quick maintain last — not front-and-center for Coach Class. */}
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

        <Link
          href={maintainHref}
          title={maintainTitle}
          aria-label={
            maintainLocked && !dayComplete
              ? `Quick maintain locked. ${maintainTitle}`
              : "Quick maintain"
          }
          className={`card relative flex items-center justify-between gap-2 overflow-hidden p-3 transition ${
            dayComplete
              ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]"
              : maintainLocked
                ? "opacity-55 grayscale-[0.45] hover:opacity-75"
                : "hover-accent-border"
          }`}
        >
          {dayComplete ? <DayCompleteStamp className="rounded-[inherit]" /> : null}
          <div className={dayComplete ? "relative z-[1] opacity-40" : undefined}>
            <p className="text-sm font-semibold">Quick maintain</p>
            <p className="text-[10px] text-[var(--muted)]">
              {maintainTileSubtitle(maintainAccess, dayComplete)}
            </p>
          </div>
          <span
            className={`relative z-[1] text-xs font-medium ${
              dayComplete
                ? "text-[var(--success)]"
                : maintainLocked
                  ? "text-[var(--muted)]"
                  : "text-accent"
            }`}
          >
            {maintainLocked && !dayComplete ? "?" : "→"}
          </span>
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
