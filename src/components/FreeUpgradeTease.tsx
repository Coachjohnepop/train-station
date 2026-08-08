"use client";

import Link from "next/link";
import { purchaseHref } from "@/lib/member-purchase-path";

type Props = {
  title: string;
  body: string;
  /** Compact inline (exercise card) vs full card */
  compact?: boolean;
  className?: string;
  ctaLabel?: string;
  plan?: "member" | "business" | "pro";
};

/** Soft upgrade CTA — Free Explorer teases, never a hard dead-end alone. */
export default function FreeUpgradeTease({
  title,
  body,
  compact = false,
  className = "",
  ctaLabel = "Upgrade to Coach Class",
  plan = "member",
}: Props) {
  const href = purchaseHref(plan, { signedIn: true, role: "MEMBER" });

  if (compact) {
    return (
      <div
        className={`rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 ${className}`}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
          Free Explorer
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{body}</p>
        <Link
          href={href}
          className="mt-2 inline-flex text-[11px] font-bold text-[var(--accent-fg)] underline-offset-2 hover:underline"
        >
          {ctaLabel} →
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`card space-y-3 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-[var(--surface)] to-[var(--surface-2)] p-4 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-600">
        Free Explorer · sample the high
      </p>
      <h3 className="text-base font-bold text-[var(--text)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={href} className="btn-primary text-sm">
          {ctaLabel}
        </Link>
        <Link
          href="/member/leaderboard"
          className="btn-ghost border border-[var(--border)] px-3 py-2 text-sm"
        >
          Scores →
        </Link>
      </div>
    </div>
  );
}
