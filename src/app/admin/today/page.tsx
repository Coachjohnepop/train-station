import Link from "next/link";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import { getAppointmentsForDate } from "@/lib/today-appointments";
import { getTodaySessionByDate } from "@/lib/today-sessions";
import { getSmsGeneratedWorkout } from "@/lib/sms-generated-workouts";

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
  const session = getTodaySessionByDate(sessionDate);
  const workout = session ? await getSmsGeneratedWorkout(session.workoutId, "Coach session") : null;
  const hasSmsWorkout = !!workout;

  const scheduledLabel = session
    ? new Date(session.scheduledAt).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

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
          {session
            ? `SMS workout scheduled — ${scheduledLabel}`
            : "Coach view — appointments, SMS workout overrides, and live sessions for the day."}
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

      {hasSmsWorkout && session && (
        <div className="-mx-4">
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
              SMS workout
            </span>
            {session.replacesSchedule && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                Overrides schedule
              </span>
            )}
          </div>
          {session.rawSms && (
            <details className="mx-4 mb-3 text-xs group">
              <summary className="flex items-center gap-2 cursor-pointer list-none text-[var(--muted)] hover:text-white">
                <span className="text-accent group-open:rotate-90 transition-transform">▶</span>
                View original SMS text
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-[11px]">
                {session.rawSms}
              </pre>
            </details>
          )}
          <MemberWorkoutConsole
            workout={workout}
            backHref={`/admin/today?date=${sessionDate}`}
            backLabel="← Go to Today"
            programSlug={session.programSlug}
            instructorName="Coach"
          />
        </div>
      )}

      <details className="group" open={appointments.length > 0}>
        <summary className="flex items-center gap-2 cursor-pointer list-none font-semibold mb-3">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          Today&apos;s appointments
          <span className="text-xs font-normal text-[var(--muted)]">({appointments.length})</span>
        </summary>
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
      </details>

      <TodaySessionPanel
        asInstructor
        programSlug={session?.programSlug || "adult"}
        userIds={session?.userIds?.length ? session.userIds : ["demo-user-john", "demo-user-stephanie"]}
        defaultDate={sessionDate}
        defaultTime={session ? new Date(session.scheduledAt).toTimeString().slice(0, 5) : "06:30"}
        collapsible
        defaultOpen={false}
      />
    </div>
  );
}