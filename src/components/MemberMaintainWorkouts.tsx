"use client";

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

  return (
    <section
      id="quick-maintain"
      className={`card relative scroll-mt-20 space-y-3 overflow-hidden p-4 ${
        dayComplete
          ? "border-[color-mix(in_srgb,var(--success)_30%,var(--border))]"
          : locked
            ? "opacity-75 grayscale-[0.35]"
            : ""
      }`}
    >
      {dayComplete ? <DayCompleteStamp /> : null}

      <div className={dayComplete ? "opacity-45" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              {dayComplete
                ? "Closed for today"
                : mode === "full"
                  ? "Business+ perk"
                  : mode === "earned"
                    ? "Earned this month"
                    : "Coach Class · locked"}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[var(--text)] sm:text-lg">
              {access?.headline || "Quick maintain (~45 min)"}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {access?.detail ||
                "Not part of your program day — grab a clean muscle-group session when you just need to train now."}
            </p>
          </div>
          {activeWorkoutId && clearHref && access?.allowed && !dayComplete ? (
            <Link
              href={clearHref}
              className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:border-accent/40 hover:text-accent"
            >
              Close
            </Link>
          ) : null}
        </div>

        {access && access.mode !== "full" && !dayComplete ? (
          <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-3 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Unlock paths
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
          <ul
            className={`mt-3 space-y-2 ${
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
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 opacity-60">
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
        ) : null}
      </div>
    </section>
  );
}
