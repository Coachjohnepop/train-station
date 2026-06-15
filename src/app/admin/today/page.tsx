import Link from "next/link";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import { getAppointmentsForDate } from "@/lib/today-appointments";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function AdminTodayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = sp.date || todayKey;
  const appointments = await getAppointmentsForDate(sessionDate);

  const prevDate = new Date(`${sessionDate}T12:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(`${sessionDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const prevKey = prevDate.toISOString().slice(0, 10);
  const nextKey = nextDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-accent hover:underline">
          ← Coach dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Go to Today</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Coach view — appointments, SMS workout overrides, and live sessions for the day.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/today?date=${prevKey}`} className="btn-ghost px-2 py-1 text-xs">
            ← Prev
          </Link>
          <span className="font-medium">{formatDateLabel(sessionDate)}</span>
          <Link href={`/admin/today?date=${nextKey}`} className="btn-ghost px-2 py-1 text-xs">
            Next →
          </Link>
          {sessionDate !== todayKey && (
            <Link href="/admin/today" className="text-xs text-accent hover:underline ml-2">
              Back to today
            </Link>
          )}
        </div>
        <span className="text-xs text-[var(--muted)]">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</span>
      </div>

      <section>
        <h2 className="font-semibold mb-3">Today&apos;s appointments</h2>
        {appointments.length === 0 ? (
          <div className="card text-sm text-[var(--muted)]">
            No appointments on this date. Paste an SMS workout below or add a booking from Bookings admin.
          </div>
        ) : (
          <ul className="space-y-3">
            {appointments.map((appt) => (
              <li key={appt.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-accent">{formatTime(appt.scheduledAt)}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          appt.type === "sms-workout"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {appt.type === "sms-workout" ? "SMS workout" : "Live booking"}
                      </span>
                      {appt.status && (
                        <span className="text-[var(--muted)] capitalize">{appt.status}</span>
                      )}
                    </div>
                    <p className="mt-1 font-medium">{appt.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {appt.memberNames.join(" · ")}
                      {appt.durationMin ? ` · ${appt.durationMin} min` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs shrink-0">
                    <Link href={appt.coachHref} className="btn-primary px-3 py-1 text-center">
                      Open (coach)
                    </Link>
                    {appt.memberIds[0] && appt.type === "sms-workout" && (
                      <Link
                        href={`/member/today?asInstructor=true&forUser=${appt.memberIds[0]}`}
                        className="btn-ghost px-3 py-1 text-center"
                      >
                        Check off for {appt.memberNames[0]}
                      </Link>
                    )}
                    {appt.memberIds[1] && appt.type === "sms-workout" && (
                      <Link
                        href={`/member/today?asInstructor=true&forUser=${appt.memberIds[1]}`}
                        className="btn-ghost px-3 py-1 text-center"
                      >
                        Check off for {appt.memberNames[1]}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TodaySessionPanel
        asInstructor
        programSlug="adult"
        userIds={["demo-user-john", "demo-user-stephanie"]}
        defaultDate={sessionDate}
        defaultTime="06:30"
        collapsible
        defaultOpen={appointments.every((a) => a.type !== "sms-workout")}
      />
    </div>
  );
}