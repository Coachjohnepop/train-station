import Link from "next/link";

export default function GoToTodayCard({
  href,
  appointmentCount = 0,
  subtitle,
  title,
  variant = "member",
  compact = false,
  statStyle = false,
}: {
  href: string;
  appointmentCount?: number;
  subtitle?: string;
  title?: string;
  variant?: "member" | "coach";
  compact?: boolean;
  statStyle?: boolean;
}) {
  const cardTitle = title ?? "Go to Today";
  const defaultSubtitle =
    variant === "coach"
      ? "Appointments & SMS workouts"
      : "Coach SMS workout & checkoffs";

  const detail =
    subtitle ||
    (appointmentCount > 0
      ? `${appointmentCount} appt${appointmentCount === 1 ? "" : "s"}`
      : defaultSubtitle);

  if (statStyle) {
    return (
      <Link
        href={href}
        className="card transition hover-accent-border ring-1 ring-accent/40 bg-accent/15"
      >
        <p className="text-sm font-semibold text-accent">{cardTitle}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums leading-none">
          {appointmentCount > 0 ? appointmentCount : "→"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      </Link>
    );
  }

  if (compact) {
    return (
      <Link
        href={href}
        className="card flex items-center justify-between gap-2 py-1 px-2 text-sm transition hover-accent-border ring-1 ring-accent/40 bg-accent/15"
      >
        <span className="font-semibold text-accent whitespace-nowrap">{cardTitle}</span>
        <span className="truncate text-xs text-[var(--muted)] text-right">{detail}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="card block transition hover-accent-border border-accent/40 bg-accent/10 py-3 px-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-accent">{cardTitle}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {subtitle ||
              (variant === "coach"
                ? "Today's appointments, SMS workouts, and live sessions."
                : "Your coach SMS workout overrides the schedule — check off sets here.")}
          </p>
        </div>
        <div className="text-right shrink-0">
          {appointmentCount > 0 && (
            <p className="text-2xl font-bold tabular-nums leading-none">{appointmentCount}</p>
          )}
          <p className="text-xs text-accent mt-1">
            {appointmentCount > 0
              ? `${appointmentCount} appt${appointmentCount === 1 ? "" : "s"} today →`
              : "Open →"}
          </p>
        </div>
      </div>
    </Link>
  );
}