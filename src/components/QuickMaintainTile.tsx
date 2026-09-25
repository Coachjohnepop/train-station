"use client";

import Link from "next/link";
import DayCompleteStamp from "@/components/DayCompleteStamp";
import { openQuickMaintainInPlace } from "@/lib/open-quick-maintain";

type Props = {
  href: string;
  title: string;
  subtitle: string;
  dayComplete: boolean;
  locked: boolean;
};

export default function QuickMaintainTile({ href, title, subtitle, dayComplete, locked }: Props) {
  return (
    <Link
      href={href}
      onClick={href.includes("#quick-maintain") ? openQuickMaintainInPlace : undefined}
      title={title}
      aria-label={locked && !dayComplete ? `Quick maintain locked. ${title}` : "Quick maintain"}
      className={`card relative flex items-center justify-between gap-2 overflow-hidden p-3 transition ${
        dayComplete
          ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]"
          : locked
            ? "opacity-55 grayscale-[0.45] hover:opacity-75"
            : "hover-accent-border"
      }`}
    >
      {dayComplete ? <DayCompleteStamp className="rounded-[inherit]" /> : null}
      <div className={dayComplete ? "relative z-[1] opacity-40" : undefined}>
        <p className="text-sm font-semibold">Quick maintain</p>
        <p className="text-[10px] text-[var(--muted)]">{subtitle}</p>
      </div>
      <span
        className={`relative z-[1] text-xs font-medium ${
          dayComplete ? "text-[var(--success)]" : locked ? "text-[var(--muted)]" : "text-accent"
        }`}
      >
        {locked && !dayComplete ? "?" : "→"}
      </span>
    </Link>
  );
}
