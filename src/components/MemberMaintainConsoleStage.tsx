"use client";

/**
 * Focus mode for Quick maintain: only the workout console pane (rest timer, sets, log).
 * Not browser fullscreen — that hid sticky timers. Exit → full Today with day chips / settings.
 */
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  /** Clear maintain and return to plain Today. */
  exitHref: string;
  workoutName: string;
  children: ReactNode;
};

export default function MemberMaintainConsoleStage({
  exitHref,
  workoutName,
  children,
}: Props) {
  return (
    <div className="maintain-focus-pane min-w-0 space-y-3">
      <header className="sticky top-[var(--member-chrome-offset,0px)] z-30 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-accent/35 bg-[color-mix(in_srgb,var(--bg)_88%,var(--surface))] px-3 py-2.5 shadow-sm backdrop-blur-md sm:mx-0">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Quick maintain
          </p>
          <p className="truncate text-sm font-semibold text-[var(--text)]">{workoutName}</p>
        </div>
        <Link
          href={exitHref}
          className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-bold text-[var(--text)] transition hover:border-accent/50 hover:text-accent"
        >
          ← Today
        </Link>
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Kept for call sites that used auto-enter on engage; focus mode is always on for maintain.
 * Scrolls the console into view when the member starts working.
 */
export function notifyMaintainWorkoutEngage() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("maintain-workout-engage"));
  requestAnimationFrame(() => {
    document
      .getElementById("member-today-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
