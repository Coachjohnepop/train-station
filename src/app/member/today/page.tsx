import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import MemberCoachMediaStrip from "@/components/MemberCoachMediaStrip";
import MemberTodayHub from "@/components/MemberTodayHub";
import MemberTodayShell from "@/components/MemberTodayShell";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import TodayPageLiveRefresh from "@/components/TodayPageLiveRefresh";
import MemberWorkoutConsole from "@/components/MemberWorkoutConsole";
import { getMemberDashboard } from "@/lib/member-context";
import { loadMemberLoggedWorkoutIds } from "@/lib/member-schedule";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveMemberUserId } from "@/lib/current-user";
import { resolveTargetUserId } from "@/lib/resolve-target-user";
import { localTodayIso, toIsoDate } from "@/lib/program-calendar";
import {
  formatCycleDayFromWeekDay,
  parseEnrollmentDayKey,
} from "@/lib/member-enrollment-day";
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
import { listCoachMembersForUi } from "@/lib/sms";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { isCoachIntakeComplete } from "@/lib/member-intake";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { getMemberContent } from "@/lib/member-content-store";
import { buildWarmupWorkoutView } from "@/lib/warmup-template";
import { getUserEnrollments } from "@/lib/data/user-data";
import { normalizeTrainingLocation } from "@/lib/program-macro-cycle";
import { formatProgramStartOption } from "@/lib/member-program-block";
import { resolveContentAccess } from "@/lib/gamification-content-access";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    asInstructor?: string;
    forUser?: string;
    date?: string;
    /** 1-based multi-part day index (AM/mid/PM) */
    part?: string;
  }>;
};

function formatDateLabel(dateKey: string) {
  const enrollment = parseEnrollmentDayKey(dateKey);
  if (enrollment) {
    return formatCycleDayFromWeekDay(enrollment.weekNumber, enrollment.dayNumber);
  }
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function MemberTodayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { isDemoMode, hydrateDemoEnrollmentsStore } = await import("@/lib/demo-enrollments");
  if (isDemoMode()) {
    const { hydrateDemoLogsStore } = await import("@/lib/demo-logs");
    await Promise.all([
      hydrateDemoLogsStore({ preferFresh: true }),
      hydrateDemoEnrollmentsStore({ preferFresh: true }),
    ]);
  }

  const [dashboard, authSession] = await Promise.all([
    getMemberDashboard(),
    getSessionUser(),
  ]);
  if (!dashboard) notFound();

  const staffCoach = authSession && isStaffRole(authSession.role);
  const asInstructor = !!sp.asInstructor || staffCoach;
  const forUser = sp.forUser;
  const uid = resolveTargetUserId(forUser, await resolveMemberUserId());
  const memberName = resolveDemoUser(uid)?.name || dashboard.user.name;

  const calendarToday = localTodayIso();
  const [upcoming, loggedSet, primaryProgram, profile, coachSettings, enrollments, memberContent] =
    await Promise.all([
    loadMemberUpcomingSessions(uid),
    loadMemberLoggedWorkoutIds(uid),
    resolvePrimaryScheduleProgram(uid),
    getMemberProfile(uid),
    getCoachSettings(),
    getUserEnrollments(uid),
    getMemberContent(),
  ]);
  const trainingLocation = normalizeTrainingLocation(
    enrollments[primaryProgram?.slug ?? "adult"]?.trainingLocation,
  );

  const dayWindow = primaryProgram
    ? await buildMemberDayWindow(uid, primaryProgram.slug, loggedSet, {
        rollingDays: 5,
        daysBefore: 2,
      })
    : null;

  const programBlock = dayWindow?.block ?? null;
  const programTodayKey = dayWindow?.programTodayKey ?? calendarToday;
  const viewDate = sp.date || programTodayKey;
  const partIndexRaw = sp.part ? Number(sp.part) : undefined;
  const partIndex =
    partIndexRaw && Number.isFinite(partIndexRaw) && partIndexRaw >= 1
      ? Math.floor(partIndexRaw)
      : undefined;
  const todayWorkout = await resolveTodayPageWorkout(uid, viewDate, memberName, {
    partIndex,
  });
  const { session, workout, programSlug, source, scheduleLabel, parts, activePartIndex } =
    todayWorkout;
  const hasWorkout = !!workout;
  const coachMembers = asInstructor
    ? (await listCoachMembersForUi()).map((m) => ({
        id: m.id,
        name: m.name,
      }))
    : [];

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
    : programBlock?.status === "pending"
      ? `Your 28-day program starts ${formatProgramStartOption(programBlock.programStartDate)}`
      : programBlock?.status === "expired"
        ? "Your 28-day block has ended — renew to continue"
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
      ? buildIntakeRampPlaceholderDays(calendarToday)
      : null;
  const memberDays = dayWindow?.days.length ? dayWindow.days : intakeRampDays ?? [];
  const memberRollup = dayWindow?.rollup ?? (intakeRampDays ? rollupForMemberDays(intakeRampDays) : null);
  const selectedSummary = memberDays.find((d) => d.iso === viewDate) ?? null;
  const stretchPreview = memberDays.length ? nextDayStretchPreview(memberDays, programTodayKey) : [];
  const tomorrowDay = memberDays.length ? nextMemberDay(memberDays, programTodayKey) : null;
  const memberWorkout = viewDate === programTodayKey ? workout : null;

  const enrollSlug = primaryProgram?.slug ?? "adult";
  const enrollPos = enrollments[enrollSlug];
  let enrollmentDayLinear: number | null = selectedSummary?.enrollmentDayNumber ?? null;
  if (enrollmentDayLinear == null && enrollPos) {
    const { linearEnrollmentDay } = await import("@/lib/member-enrollment-day");
    enrollmentDayLinear = linearEnrollmentDay(
      enrollPos.currentWeek || 1,
      enrollPos.currentDay || 1,
    );
  }

  const contentAccess = await resolveContentAccess({
    userId: uid,
    profilePlan: profile?.plan,
    enrollmentDay: enrollmentDayLinear ?? undefined,
    bypass: Boolean(asInstructor),
  });
  return (
    <div className="space-y-4">
      <TodayPageLiveRefresh
        userId={uid}
        viewDate={viewDate}
        sessionId={session?.id}
        workoutId={session?.workoutId || workout?.workoutId}
        assignmentStamp={session?.createdAt ?? null}
      />

      {!asInstructor ? (
        <>
          <MemberCoachMediaStrip content={memberContent} />

          <Suspense fallback={<div className="card h-40 animate-pulse p-4" />}>
            <MemberTodayShell
              todayIso={programTodayKey}
              selectedDate={viewDate}
              days={memberDays}
              rollup={memberRollup}
              selectedSummary={selectedSummary}
              nextStretchPreview={stretchPreview}
              tomorrowDay={tomorrowDay}
              workout={memberWorkout}
              programSlug={programSlug}
              trainingLocation={trainingLocation}
              targetUserId={uid}
              scheduleLabel={scheduleLabel}
              calendarDateLabel={formatDateLabel(viewDate)}
              subtitle={subtitle}
              dayParts={parts && parts.length > 1 ? parts : undefined}
              activePartIndex={activePartIndex}
              hasCoachSession={!!session}
              intakeComplete={intakeComplete}
              warmupWorkout={warmupWorkout}
              introBookedAt={profile?.introBookedAt ?? null}
              coachMeetingRequestedAt={profile?.coachMeetingRequestedAt ?? null}
              coachMeetingRequestNote={profile?.coachMeetingRequestNote ?? null}
              autoPromptIntroBooking={coachSettings.autoPromptIntroBooking}
              autoPromptFollowUpBooking={coachSettings.autoPromptFollowUpBooking}
              programBlock={programBlock}
              contentAccess={asInstructor ? null : contentAccess}
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
            <div className="min-w-0">
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