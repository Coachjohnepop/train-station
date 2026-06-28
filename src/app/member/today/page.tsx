import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import MemberTodayHub from "@/components/MemberTodayHub";
import MemberTodayShell from "@/components/MemberTodayShell";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import TodayPageLiveRefresh from "@/components/TodayPageLiveRefresh";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import { getMemberDashboard } from "@/lib/member-context";
import { loadMemberLoggedWorkoutIds } from "@/lib/member-schedule";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveUserId } from "@/lib/current-user";
import { resolveTargetUserId } from "@/lib/resolve-target-user";
import { localTodayIso, toIsoDate } from "@/lib/program-calendar";
import { loadMemberUpcomingSessions, memberTodayHref } from "@/lib/member-today";
import { resolveTodayPageWorkout } from "@/lib/member-today-workout";
import {
  buildIntakeRampPlaceholderDays,
  buildMemberDayWindow,
  nextDayStretchPreview,
  nextMemberDay,
  resolvePrimaryScheduleProgram,
  rollupForMemberDays,
} from "@/lib/member-day-window";
import { listDemoMembersForCoach } from "@/lib/sms";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isCoachIntakeComplete } from "@/lib/member-intake";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { buildWarmupWorkoutView } from "@/lib/warmup-template";

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
  const [dashboard, authSession] = await Promise.all([
    getMemberDashboard(),
    getSessionUser(),
  ]);
  if (!dashboard) notFound();

  const staffCoach = authSession && isStaffRole(authSession.role);
  const asInstructor = !!sp.asInstructor || staffCoach;
  const forUser = sp.forUser;
  const uid = resolveTargetUserId(forUser, await resolveUserId());
  const memberName = resolveDemoUser(uid)?.name || dashboard.user.name;

  const todayKey = localTodayIso();
  const viewDate = sp.date || todayKey;
  const [todayWorkout, upcoming, loggedSet, primaryProgram, profile, coachSettings] =
    await Promise.all([
      resolveTodayPageWorkout(uid, viewDate, memberName),
      loadMemberUpcomingSessions(uid),
      loadMemberLoggedWorkoutIds(uid),
      resolvePrimaryScheduleProgram(uid),
      getMemberProfile(uid),
      getCoachSettings(),
    ]);

  const dayWindow = primaryProgram
    ? await buildMemberDayWindow(uid, primaryProgram.slug, loggedSet, {
        rollingDays: 21,
        daysBefore: 7,
      })
    : null;

  const { session, workout, programSlug, source, scheduleLabel } = todayWorkout;
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

  const subtitle = session
    ? isUpcoming
      ? `Coach workout scheduled — ${scheduledLabel}`
      : `Today's coach workout — ${scheduledLabel}`
    : source === "program"
      ? `Program schedule — ${scheduleLabel}`
      : "Spin the day wheel to see what you've done and what's ahead.";

  const intakeComplete =
    !uid.startsWith("member-") || isCoachIntakeComplete(profile);
  const warmupWorkout = !intakeComplete
    ? buildWarmupWorkoutView(memberName, coachSettings.warmupBlocks)
    : null;
  const intakeRampDays =
    !intakeComplete && warmupWorkout && !(dayWindow?.days.length)
      ? buildIntakeRampPlaceholderDays(todayKey)
      : null;
  const memberDays = dayWindow?.days.length ? dayWindow.days : intakeRampDays ?? [];
  const memberRollup = dayWindow?.rollup ?? (intakeRampDays ? rollupForMemberDays(intakeRampDays) : null);
  const selectedSummary = memberDays.find((d) => d.iso === viewDate) ?? null;
  const stretchPreview = memberDays.length ? nextDayStretchPreview(memberDays, todayKey) : [];
  const tomorrowDay = memberDays.length ? nextMemberDay(memberDays, todayKey) : null;
  const memberWorkout = viewDate === todayKey ? workout : null;

  return (
    <div className="space-y-4">
      <TodayPageLiveRefresh
        userId={uid}
        viewDate={viewDate}
        sessionId={session?.id}
        workoutId={session?.workoutId || workout?.workoutId}
      />

      {!asInstructor ? (
        <>
          <Suspense fallback={<div className="card h-40 animate-pulse p-4" />}>
            <MemberTodayShell
              todayIso={todayKey}
              selectedDate={viewDate}
              days={memberDays}
              rollup={memberRollup}
              selectedSummary={selectedSummary}
              nextStretchPreview={stretchPreview}
              tomorrowDay={tomorrowDay}
              workout={memberWorkout}
              programSlug={programSlug}
              targetUserId={uid}
              scheduleLabel={scheduleLabel}
              calendarDateLabel={formatDateLabel(viewDate)}
              subtitle={subtitle}
              hasCoachSession={!!session}
              intakeComplete={intakeComplete}
              warmupWorkout={warmupWorkout}
              introBookedAt={profile?.introBookedAt ?? null}
              coachMeetingRequestedAt={profile?.coachMeetingRequestedAt ?? null}
              coachMeetingRequestNote={profile?.coachMeetingRequestNote ?? null}
            />
          </Suspense>

          {upcoming.length > 0 && (
            <details className="card py-2 px-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-accent">
                Coach-assigned workouts ({upcoming.length})
              </summary>
              <ul className="mt-2 space-y-1">
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
                      })}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <MemberTodayHub dashboard={dashboard} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Today</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
              <p className="mt-1 text-xs text-amber-300">
                Coaching {memberName} — checkoffs sync live to their screen.
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
          </div>

          {hasWorkout ? (
            <div className="-mx-4">
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
                backHref={sp.date ? `/member/today?date=${sp.date}` : "/member/today"}
                backLabel="← Go to Today"
                programSlug={programSlug}
                targetUserId={uid}
                instructorName="Coach"
                liveSyncUserId={uid}
                liveSessionDate={viewDate}
                scheduleLabel={scheduleLabel}
                calendarDateLabel={formatDateLabel(viewDate)}
              />
            </div>
          ) : (
            <div className="card text-sm text-[var(--muted)]">
              <p>
                {session
                  ? "Workout is still building — paste SMS in Text Upload below."
                  : `No workout assigned for ${memberName} on this date yet.`}
              </p>
            </div>
          )}

          <TodaySessionPanel
            asInstructor
            programSlug={programSlug}
            memberOptions={coachMembers}
            defaultUserIds={[uid]}
            defaultDate={viewDate}
            lockSessionDate={viewDate}
            viewDateLabel={formatDateLabel(viewDate)}
            defaultTime={session ? new Date(session.scheduledAt).toTimeString().slice(0, 5) : "06:30"}
            collapsible
            defaultAssignOpen={!session}
            defaultOpen={!hasWorkout}
          />
        </>
      )}
    </div>
  );
}