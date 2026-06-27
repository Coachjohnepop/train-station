"use client";

import type { CoachContentAlert } from "@/lib/coach-content-alerts";

type Props = {
  alert: CoachContentAlert;
  onJumpToWeek?: (weekNumber: number) => void;
  onCopyPrevWeek?: (toWeek: number, fromWeek: number) => void;
  onCopyWeek1Remaining?: () => void;
};

export default function ProgramContentReadinessBanner({
  alert,
  onJumpToWeek,
  onCopyPrevWeek,
  onCopyWeek1Remaining,
}: Props) {
  const { readiness, focus, suggestions } = alert;
  const border =
    readiness.alertLevel === "critical"
      ? "border-red-500/45 bg-red-950/20"
      : readiness.alertLevel === "warn"
        ? "border-amber-500/45 bg-amber-950/15"
        : "border-emerald-500/35 bg-emerald-950/15";

  const headline = readiness.isCurrentWithClients
    ? `You're current — week ${readiness.anchorWeek} and week ${readiness.nextWeek?.weekNumber ?? readiness.anchorWeek + 1} are ready for members.`
    : !readiness.currentWeekComplete
      ? `Week ${readiness.anchorWeek} needs content before members run out of sessions.`
      : `Week ${readiness.nextWeek?.weekNumber ?? readiness.anchorWeek + 1} needs content — clients need the following week built.`;

  function runSuggestion(s: (typeof suggestions)[number]) {
    if (s.action === "open-week" || s.action === "publish-week" || s.action === "text-upload") {
      if (s.weekNumber) onJumpToWeek?.(s.weekNumber);
      return;
    }
    if (s.action === "copy-prev-week" && s.weekNumber && s.fromWeekNumber) {
      onCopyPrevWeek?.(s.weekNumber, s.fromWeekNumber);
      return;
    }
    if (s.action === "copy-week-1-remaining") {
      onCopyWeek1Remaining?.();
    }
  }

  return (
    <div className={`mt-4 rounded-xl border p-4 ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Content readiness · {focus.label}
          </p>
          <p className="mt-1 text-sm">{headline}</p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Rule: current week + following week published for enrolled clients. Calendar week{" "}
            {readiness.calendarWeek}
            {readiness.enrollmentMaxWeek > readiness.calendarWeek &&
              ` · members up to W${readiness.enrollmentMaxWeek}`}
            .
          </p>
        </div>
        {readiness.incompleteDayCount > 0 && (
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold">
            {readiness.incompleteDayCount} day{readiness.incompleteDayCount === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {suggestions.slice(0, 3).map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{s.title}</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">{s.detail}</p>
              </div>
              {(onJumpToWeek || onCopyPrevWeek || onCopyWeek1Remaining) && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2 py-1 text-[10px]"
                  onClick={() => runSuggestion(s)}
                >
                  {s.action === "copy-prev-week"
                    ? "Copy week →"
                    : s.action === "copy-week-1-remaining"
                      ? "Copy to remaining"
                      : "Go →"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-[var(--muted)]">
        Focus: {focus.summary}
      </p>
    </div>
  );
}