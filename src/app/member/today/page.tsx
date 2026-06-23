import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import { getMemberDashboard } from "@/lib/member-context";
import { getSmsGeneratedWorkout } from "@/lib/sms-generated-workouts";
import { resolveUserId } from "@/lib/current-user";
import { resolveTargetUserId } from "@/lib/resolve-target-user";
import { resolveMemberGoToToday } from "@/lib/go-to-today";
import { localTodayIso, toIsoDate } from "@/lib/program-calendar";
import { loadMemberUpcomingSessions, memberTodayHref, resolveMemberSession } from "@/lib/member-today";
import { listDemoMembersForCoach } from "@/lib/sms";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ asInstructor?: string; forUser?: string; date?: string }>;
};

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function MemberTodayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const asInstructor = !!sp.asInstructor;
  const forUser = sp.forUser;
  const uid = resolveTargetUserId(forUser, await resolveUserId());

  const dashboard = await getMemberDashboard();
  if (!dashboard) notFound();

  if (!sp.date && !asInstructor) {
    const target = await resolveMemberGoToToday(uid);
    if (target.kind === "program") redirect(target.href);
  }

  const todayKey = localTodayIso();
  const [session, upcoming, programToday] = await Promise.all([
    resolveMemberSession(uid, sp.date),
    loadMemberUpcomingSessions(uid),
    resolveMemberGoToToday(uid),
  ]);
  const viewDate = sp.date || session?.sessionDate || todayKey;
  const workout = session ? await getSmsGeneratedWorkout(session.workoutId, dashboard.user.name) : null;
  const hasWorkout = !!workout;
  const coachMembers = listDemoMembersForCoach().map((m) => ({ id: m.id, name: m.name }));

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

  const prevDate = new Date(`${viewDate}T12:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(`${viewDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const prevKey = toIsoDate(prevDate);
  const nextKey = toIsoDate(nextDate);
  const dateQuery = (d: string) => {
    const q = new URLSearchParams();
    if (asInstructor) q.set("asInstructor", "true");
    if (forUser) q.set("forUser", forUser);
    q.set("date", d);
    return `?${q.toString()}`;
  };

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
                ? `Coach workout scheduled — ${scheduledLabel}`
                : `Today's coach workout — ${scheduledLabel}`
              : "No coach workout for this date yet. Check your program schedule or ask your coach."}
          </p>
        </div>
        {session?.replacesSchedule && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
            Overrides schedule
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/member/today${dateQuery(prevKey)}`} className="btn-ghost px-2 py-1 text-xs">
          ← Prev
        </Link>
        <span className="font-medium">{formatDateLabel(viewDate)}</span>
        <Link href={`/member/today${dateQuery(nextKey)}`} className="btn-ghost px-2 py-1 text-xs">
          Next →
        </Link>
        {viewDate !== todayKey && (
          <Link href="/member/today" className="text-xs text-accent hover:underline ml-1">
            Jump to today
          </Link>
        )}
      </div>

      {!asInstructor && upcoming.length > 0 && (
        <div className="card py-2 px-3 text-sm">
          <p className="text-xs font-semibold text-accent mb-2">Your coach workouts</p>
          <ul className="space-y-1">
            {upcoming.map((s) => (
              <li key={s.id}>
                <Link
                  href={memberTodayHref(s)}
                  className={`hover:underline ${s.sessionDate === session?.sessionDate ? "text-accent font-medium" : "text-[var(--muted)]"}`}
                >
                  {s.title} —{" "}
                  {new Date(s.scheduledAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {s.replacesSchedule ? " · overrides schedule" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWorkout ? (
        <div className="-mx-4">
          {asInstructor && (
            <div className="mx-4 mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>Coach mode</strong> — checking off on behalf of the member. {forUser && `(User: ${forUser})`}
            </div>
          )}
          {asInstructor && session?.rawSms && (
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
            backHref={sp.date ? `/member/today?date=${sp.date}` : "/member/today"}
            backLabel="← Go to Today"
            programSlug={session?.programSlug || "adult"}
            targetUserId={uid}
            instructorName={asInstructor ? "Coach" : undefined}
            liveSyncUserId={uid}
            liveSessionDate={viewDate}
          />
        </div>
      ) : (
        !asInstructor && (
          <div className="card text-sm text-[var(--muted)]">
            <p>
              {session
                ? "Workout is still building — ask your coach to repost, or try another date with Prev/Next."
                : "No coach workout assigned for you on this date."}
            </p>
            <Link
              href={programToday.kind === "program" ? programToday.href : "/member/programs/adult"}
              className="mt-2 inline-block text-accent hover:underline"
            >
              Open today&apos;s program workout →
            </Link>
          </div>
        )
      )}

      {asInstructor && (
        <TodaySessionPanel
          asInstructor
          programSlug={session?.programSlug || "adult"}
          memberOptions={coachMembers}
          defaultUserIds={
            forUser ? [forUser] : session?.userIds?.length ? session.userIds : [DEFAULT_DEMO_MEMBER_ID]
          }
          defaultDate={session?.sessionDate || viewDate}
          defaultTime={session ? new Date(session.scheduledAt).toTimeString().slice(0, 5) : "06:30"}
          collapsible
          defaultOpen={false}
        />
      )}
    </div>
  );
}