"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DayCompleteStamp from "@/components/DayCompleteStamp";
import type {
  MaintainAccess,
  MaintainWorkoutCard,
} from "@/lib/member-maintain-workouts";

type Props = {
  workouts: MaintainWorkoutCard[];
  /** Base path for opening one (keeps today context). */
  hrefFor: (workoutId: string) => string;
  /** Clear maintain selection and return to program day. */
  clearHref?: string | null;
  activeWorkoutId?: string | null;
  access?: MaintainAccess | null;
};

export default function MemberMaintainWorkouts({
  workouts,
  hrefFor,
  clearHref = null,
  activeWorkoutId = null,
  access = null,
}: Props) {
  if (!workouts.length && !access) return null;

  const dayComplete = Boolean(access?.dayComplete);
  const locked = access ? !access.allowed : false;
  const mode = access?.mode ?? "full";
  const blockInteraction = locked || dayComplete;

  // Collapsed by default when locked (not front-and-center). Expand when
  // deep-linked (#quick-maintain) or a session is already open.
  const [expanded, setExpanded] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash === "#quick-maintain") {
      return true;
    }
    return Boolean(activeWorkoutId) && !locked;
  });

  useEffect(() => {
    if (activeWorkoutId && !locked) setExpanded(true);
  }, [activeWorkoutId, locked]);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#quick-maintain") {
        setExpanded(true);
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const title = access?.headline || "Quick maintain (~45 min)";
  const unlockTitle =
    access?.detail ||
    "Coach Class: complete this month’s show-ups and on-demand content to unlock, or upgrade to Business for unlimited.";

  return (
    <section
      id="quick-maintain"
      className={`card relative scroll-mt-20 overflow-hidden ${
        dayComplete
          ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]"
          : locked
            ? "opacity-80 grayscale-[0.25]"
            : ""
      }`}
    >
      {dayComplete ? <DayCompleteStamp /> : null}

      <div className={dayComplete ? "opacity-45" : undefined}>
        <div className="flex items-start gap-2 p-4 pb-3">
          <button
            type="button"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-accent/40 hover:text-accent"
            aria-expanded={expanded}
            aria-controls="quick-maintain-body"
            title={locked && !dayComplete ? unlockTitle : undefined}
            onClick={() => setExpanded((v) => !v)}
          >
            <span
              className={`text-xs transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
              aria-hidden
            >
              ▶
            </span>
            <span className="sr-only">{expanded ? "Collapse" : "Expand"} Quick maintain</span>
          </button>

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
            title={locked && !dayComplete ? unlockTitle : undefined}
            onClick={() => setExpanded((v) => !v)}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              {dayComplete
                ? "Closed for today"
                : mode === "full"
                  ? "Business+ perk"
                  : mode === "earned"
                    ? "Earned this month"
                    : "Coach Class · not day-1"}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[var(--text)] sm:text-lg">
              {title}
            </h2>
            {!expanded ? (
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {activeWorkoutId
                  ? "Session open — tap to change workout"
                  : locked && !dayComplete
                    ? "Tap for how to unlock · greyed until you qualify"
                    : "Tap to expand library"}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {access?.detail ||
                  "Not part of your program day — grab a clean muscle-group session when you just need to train now."}
              </p>
            )}
          </button>

          {activeWorkoutId && clearHref && access?.allowed && !dayComplete ? (
            <Link
              href={clearHref}
              className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:border-accent/40 hover:text-accent"
              onClick={(e) => e.stopPropagation()}
            >
              Close
            </Link>
          ) : null}
        </div>

        {expanded ? (
          <div id="quick-maintain-body" className="space-y-3 px-4 pb-4">
            {access && access.mode !== "full" && !dayComplete ? (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {locked ? "How to unlock Quick maintain" : "Your earn path"}
                </p>
                <p className="text-[11px] leading-snug text-[var(--muted)]">
                  Not available on day one for Coach Class. Complete the steps below for{" "}
                  {access.usesLimit ?? 5} uses this month, or go Business for unlimited.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={access.upgradeHref}
                    className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-[var(--bg)]"
                  >
                    Upgrade to Business · unlimited
                  </Link>
                </div>
                <ul className="mt-2 space-y-1 text-[var(--muted)]">
                  <li className={access.showUpsMet ? "text-[var(--success)]" : ""}>
                    {access.showUpsMet ? "✓" : "○"} Show up to {access.showUpsNeeded}{" "}
                    workouts this month ({access.showUps}/{access.showUpsNeeded})
                  </li>
                  {access.onDemandParts.length === 0 ? (
                    <li className="text-[var(--success)]">
                      ✓ On-demand: nothing extra this month
                    </li>
                  ) : (
                    access.onDemandParts.map((p) => (
                      <li key={p.id} className={p.done ? "text-[var(--success)]" : ""}>
                        {p.done ? "✓" : "○"}{" "}
                        <Link href={p.href} className="underline-offset-2 hover:underline">
                          {p.label}
                        </Link>
                      </li>
                    ))
                  )}
                  <li className={access.earnReady ? "text-accent" : ""}>
                    → Then {access.usesLimit ?? 5} maintain uses / month
                    {access.mode === "earned" && access.usesRemaining != null
                      ? ` · ${access.usesRemaining} left`
                      : ""}
                  </li>
                </ul>
              </div>
            ) : null}

            {workouts.length > 0 ? (
              <div className="space-y-2">
                {locked && !dayComplete ? (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Sessions (greyed until you qualify)
                  </p>
                ) : null}
                <ul
                  className={`space-y-2 ${
                    blockInteraction ? "pointer-events-none select-none" : ""
                  }`}
                >
                  {workouts.map((w) => {
                    const active = activeWorkoutId === w.id;
                    const inner = (
                      <>
                        <span className="min-w-0">
                          <span className="block font-semibold text-[var(--text)]">{w.name}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                            {w.muscleGroup} · {w.durationMin} min · {w.exerciseCount} exercises
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                            {w.blurb}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-accent">
                          {dayComplete
                            ? "—"
                            : locked
                              ? "Locked"
                              : active
                                ? "Open"
                                : "Start →"}
                        </span>
                      </>
                    );
                    return (
                      <li key={w.id}>
                        {blockInteraction ? (
                          <div
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 opacity-50 grayscale-[0.4]"
                            title={
                              locked && !dayComplete
                                ? unlockTitle
                                : dayComplete
                                  ? "Day complete — try again tomorrow"
                                  : undefined
                            }
                          >
                            {inner}
                          </div>
                        ) : (
                          <Link
                            href={hrefFor(w.id)}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition ${
                              active
                                ? "border-accent bg-accent/10"
                                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-accent/50"
                            }`}
                          >
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
