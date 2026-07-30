"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** localStorage — coach can hide the map after they know the building. */
export const COACH_START_HERE_DISMISS_KEY = "ts-coach-start-here-dismissed";

type JobLink = {
  href: string;
  label: string;
  oneLiner: string;
  /** Accent chip */
  chip: string;
};

/**
 * Coach “app 101” map on Day dashboard.
 * Job-shaped doors — not more nav noise.
 */
const COACH_JOBS: JobLink[] = [
  {
    href: "/admin/today",
    label: "Today’s floor",
    oneLiner: "Live set checkoffs with members who are training right now.",
    chip: "Floor",
  },
  {
    href: "/admin/chat",
    label: "Message a member",
    oneLiner: "Private coach thread — people, not program building.",
    chip: "People",
  },
  {
    href: "/admin/programs",
    label: "Build / fix the plan",
    oneLiner: "Weeks, days, and workouts (curriculum factory).",
    chip: "Build",
  },
  {
    href: "/admin/equipment",
    label: "Gear catalog",
    oneLiner: "Photos, store links, and what members own at home.",
    chip: "Gear",
  },
  {
    href: "/admin/videos",
    label: "Coach videos",
    oneLiner: "Intros members hear (welcome, Gear, free ticket, etc.).",
    chip: "Video",
  },
];

export default function CoachStartHereCard() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const hide = localStorage.getItem(COACH_START_HERE_DISMISS_KEY) === "1";
      setDismissed(hide);
      setExpanded(!hide);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(COACH_START_HERE_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setExpanded(false);
  }, []);

  const showAgain = useCallback(() => {
    try {
      localStorage.removeItem(COACH_START_HERE_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
    setExpanded(true);
  }, []);

  if (!ready) return null;

  if (dismissed && !expanded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <p className="text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">Coach map</span>
          {" · "}
          five places that matter
        </p>
        <button
          type="button"
          onClick={showAgain}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Show Start here
        </button>
      </div>
    );
  }

  return (
    <section
      className="card space-y-3 border-accent/35 bg-gradient-to-b from-accent/10 to-[var(--surface)] p-4"
      aria-labelledby="coach-start-here-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Coach app 101
          </p>
          <h2 id="coach-start-here-title" className="mt-0.5 text-base font-bold text-[var(--text)]">
            Start here — five places that matter
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted)]">
            This dashboard is home base. Everything else is a job: floor, people, build the plan,
            gear, or your videos. Pick a door — you can hide this once it sticks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn-ghost px-2.5 py-1 text-[11px]"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button type="button" onClick={dismiss} className="btn-ghost px-2.5 py-1 text-[11px]">
            Got it — hide
          </button>
        </div>
      </div>

      {expanded ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {COACH_JOBS.map((job) => (
            <li key={job.href}>
              <Link
                href={job.href}
                className="group flex min-h-[3.25rem] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5 transition hover:border-accent/50 hover:bg-accent/10"
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                  {job.chip}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)] group-hover:text-accent">
                    {job.label}
                    <span className="ml-1 text-accent opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">
                    {job.oneLiner}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[10px] text-[var(--muted)]">
        Tip: <strong className="text-[var(--text)]">Day</strong> (this page) = what you&apos;re
        coaching now. <strong className="text-[var(--text)]">Programs</strong> = build the weeks.
        Don&apos;t hunt chat for workouts or programs for messages.
      </p>
    </section>
  );
}
