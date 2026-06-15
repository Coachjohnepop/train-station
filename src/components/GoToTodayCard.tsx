import Link from "next/link";

export default function GoToTodayCard({
  href,
  appointmentCount = 0,
  subtitle,
  variant = "member",
}: {
  href: string;
  appointmentCount?: number;
  subtitle?: string;
  variant?: "member" | "coach";
}) {
  return (
    <Link
      href={href}
      className="card block transition hover-accent-border border-accent/40 bg-accent/10 py-3 px-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-accent">Go to Today</p>
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