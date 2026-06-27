import Link from "next/link";
import type { CoachContentAlert } from "@/lib/coach-content-alerts";

function alertBorder(level: CoachContentAlert["readiness"]["alertLevel"]) {
  if (level === "critical") return "border-red-500/45";
  if (level === "warn") return "border-amber-500/45";
  return "border-emerald-500/35";
}

function alertHeadline(alert: CoachContentAlert): string {
  const { readiness } = alert;
  if (readiness.isCurrentWithClients) {
    return `Week ${readiness.anchorWeek} + ${readiness.nextWeek?.weekNumber ?? readiness.anchorWeek + 1} ready`;
  }
  if (!readiness.currentWeekComplete) {
    return `Week ${readiness.anchorWeek} needs content`;
  }
  return `Week ${readiness.nextWeek?.weekNumber ?? readiness.anchorWeek + 1} needs content`;
}

export default function CoachContentAlertsPanel({ alerts }: { alerts: CoachContentAlert[] }) {
  const actionable = alerts.filter((a) => !a.readiness.isCurrentWithClients);
  const current = alerts.filter((a) => a.readiness.isCurrentWithClients && a.enrolledCount > 0);

  if (alerts.length === 0) {
    return (
      <div className="card border border-[var(--border)] p-4">
        <p className="text-sm font-semibold">Program content alerts</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          No live workout programs in the catalog yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionable.length > 0 && (
        <div className="card border border-amber-500/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                Content alerts
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stay current: publish <strong>this week</strong> and the <strong>following week</strong>{" "}
                for every enrolled program.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
              {actionable.length} need attention
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {actionable.map((alert) => (
              <li
                key={alert.programSlug}
                className={`rounded-xl border bg-[var(--surface)] p-3 ${alertBorder(alert.readiness.alertLevel)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/admin/programs/${alert.programSlug}`}
                      className="font-semibold hover:text-accent"
                    >
                      {alert.programName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {alertHeadline(alert)}
                      {alert.enrolledCount > 0 && (
                        <>
                          {" "}
                          · {alert.enrolledCount} member{alert.enrolledCount === 1 ? "" : "s"} ·{" "}
                          {alert.focus.label}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/admin/programs/${alert.programSlug}`}
                    className="text-xs font-medium text-accent hover:underline whitespace-nowrap"
                  >
                    Open builder →
                  </Link>
                </div>

                {alert.suggestions[0] && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">
                      {alert.suggestions[0].title}:
                    </span>{" "}
                    {alert.suggestions[0].detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {current.length > 0 && (
        <div className="card border border-emerald-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Current with clients
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {current.map((alert) => (
              <li key={alert.programSlug} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Link href={`/admin/programs/${alert.programSlug}`} className="hover:text-accent">
                    {alert.programName}
                  </Link>
                  <span className="text-xs text-[var(--muted)] ml-2">
                    W{alert.readiness.anchorWeek} + W{alert.readiness.nextWeek?.weekNumber} ·{" "}
                    {alert.focus.label}
                  </span>
                </span>
                <span className="text-xs text-emerald-300">✓ Ready</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}