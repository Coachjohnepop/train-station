import Link from "next/link";
import { notFound } from "next/navigation";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import { getMemberDashboard } from "@/lib/member-context";
import { getTodaySessionByDate, getTodaySessionForUser } from "@/lib/today-sessions";
import { getSmsGeneratedWorkout } from "@/lib/sms-generated-workouts";
import { resolveUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ asInstructor?: string; forUser?: string; date?: string }>;
};

export default async function MemberTodayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const asInstructor = !!sp.asInstructor;
  const forUser = sp.forUser;
  const uid = forUser || (await resolveUserId("demo-user"));

  const dashboard = await getMemberDashboard();
  if (!dashboard) notFound();

  const session = sp.date
    ? (() => {
        const s = getTodaySessionByDate(sp.date!);
        if (!s) return null;
        if (s.userIds.length > 0 && !s.userIds.includes(uid)) return null;
        return s;
      })()
    : getTodaySessionForUser(uid);
  const workout = session ? await getSmsGeneratedWorkout(session.workoutId, dashboard.user.name) : null;
  const hasWorkout = !!workout;

  const scheduledLabel = session
    ? new Date(session.scheduledAt).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const isUpcoming =
    session && new Date(session.scheduledAt).toDateString() !== new Date().toDateString();

  return (
    <div className="space-y-4">
      <Link href="/member" className="text-xs text-accent hover:underline">
        ← Dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Go to Today</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {session
              ? isUpcoming
                ? `Upcoming coach session — ${scheduledLabel}`
                : `Today's session — ${scheduledLabel}`
              : "No coach SMS session scheduled yet. Paste one below or check your program schedule."}
          </p>
        </div>
        {session?.replacesSchedule && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
            Overrides schedule
          </span>
        )}
      </div>

      {hasWorkout ? (
        <div className="-mx-4">
          {asInstructor && (
            <div className="mx-4 mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>Coach mode</strong> — checking off on behalf of the member. {forUser && `(User: ${forUser})`}
            </div>
          )}
          {session?.rawSms && (
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
            backHref="/member/today"
            backLabel="← Go to Today"
            programSlug={session?.programSlug || "adult"}
            instructorName={asInstructor ? "Coach" : undefined}
          />
        </div>
      ) : (
        !asInstructor && (
          <div className="card text-sm text-[var(--muted)]">
            <p>
              {session
                ? "This session is assigned to other members. Switch to John or Stephanie in admin, or paste a new SMS workout below."
                : "No parsed workout for today yet."}
            </p>
            <Link href="/member/programs/adult" className="mt-2 inline-block text-accent hover:underline">
              View program schedule instead →
            </Link>
          </div>
        )
      )}

      <TodaySessionPanel
        asInstructor={asInstructor}
        programSlug={session?.programSlug || "adult"}
        userIds={forUser ? [forUser] : session?.userIds?.length ? session.userIds : [uid]}
        defaultDate={session?.sessionDate || new Date().toISOString().slice(0, 10)}
        defaultTime={session ? new Date(session.scheduledAt).toTimeString().slice(0, 5) : "06:30"}
        collapsible
        defaultOpen={false}
      />
    </div>
  );
}