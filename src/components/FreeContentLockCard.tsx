import Link from "next/link";
import type { ContentAccessResult } from "@/lib/gamification-content-access";
import { purchaseHref } from "@/lib/member-purchase-path";

type Props = {
  access: ContentAccessResult;
};

/** Shown on Today when Free ticket hits a day outside the free pool. */
export default function FreeContentLockCard({ access }: Props) {
  const upgradePlan = access.upgradePlan || "member";
  const upgradeHref = purchaseHref(upgradePlan, { signedIn: true, role: "MEMBER" });

  return (
    <div className="card space-y-4 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-[var(--surface)] to-[#1a1030] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
        Free ticket · {access.freeContentPercent}% of cycle
      </p>
      <h2 className="text-xl font-bold text-[var(--text)]">This day is behind the velvet rope</h2>
      <p className="text-sm text-[var(--muted)]">
        {access.reason ||
          `Free Explorer includes about ${access.freeContentPercent}% of the program (days 1–${access.freeDaysInCycle} of each ${access.cycleDays}-day cycle).`}
      </p>
      {access.dayInCycle != null ? (
        <p className="text-xs text-[var(--muted)]">
          This is day <span className="font-semibold text-[var(--text)]">{access.dayInCycle}</span> of{" "}
          {access.cycleDays}. Use the day wheel above for free days (1–{access.freeDaysInCycle}), or
          climb the Free division board — top band can claim a free week of{" "}
          {access.upgradeLabel || "Coach Class"}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href={upgradeHref} className="btn-primary">
          Upgrade to {access.upgradeLabel || "Coach Class"}
        </Link>
        <Link href="/member/leaderboard" className="btn-ghost border border-[var(--border)] px-3 py-2 text-sm">
          Play the scoreboard →
        </Link>
      </div>
    </div>
  );
}
