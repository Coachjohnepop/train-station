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
import { loadMemberLoggedCalendarDates, loadMemberLoggedWorkoutIds } from "@/lib/member-schedule";
import { markDaysCompleted } from "@/lib/member-day-completion";
import { attachFinisherNames } from "@/lib/day-finishers-format";
import { listFinishersByCalendarDates } from "@/lib/day-finishers";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { resolveMemberUserId } from "@/lib/current-user";
import { resolveTargetUserId } from "@/lib/resolve-target-user";
import { localTodayIso, toIsoDate } from "@/lib/program-calendar";
import { cookies } from "next/headers";
import { SITE_SEEN_COOKIE, finishedSetupThisVisit, isFirstTimeOnSite } from "@/lib/site-visit";
import {
  formatCycleDayFromWeekDay,
  parseEnrollmentDayKey,
} from "@/lib/member-enrollment-day";
import { loadMemberUpcomingSessions, memberTodayHref } from "@/lib/member-today";
import { resolveTodayPageWorkout } from "@/lib/member-today-workout";
import {
  buildCalendarSwipeDays,
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
import {
  canSeeMaintainTeaser,
  isMaintainWorkoutId,
  listMaintainWorkouts,
  resolveMaintainAccess,
} from "@/lib/member-maintain-workouts";
import { getMemberWorkoutById } from "@/lib/member-workout";
import { listUserMeasurements } from "@/lib/measurements-store";
import {
  isoDateFromTimestamp,
  resolveMeasurementDay,
} from "@/lib/member-measurement-schedule";
import {
  previewRollingDays,
  schedulePreviewForEmail,
} from "@/lib/member-schedule-preview";
import { normalizeSignupPlan } from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    asInstructor?: string;
    forUser?: string;
    date?: string;
    /** 1-based multi-part day index (AM/mid/PM) */
    part?: string;
    /** Business+ quick maintain workout id */
    maintain?: string;
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
  const firstTimeOnSite = isFirstTimeOnSite(
    (await cookies()).get(SITE_SEEN_COOKIE)?.value,
  );
  const [upcoming, loggedSet, loggedDates, primaryProgram, profile, coachSettings, enrollments, memberContent] =
    await Promise.all([
    loadMemberUpcomingSessions(uid),
    loadMemberLoggedWorkoutIds(uid),
    loadMemberLoggedCalendarDates(uid),
    resolvePrimaryScheduleProgram(uid),
    getMemberProfile(uid),
    getCoachSettings(),
    getUserEnrollments(uid),
    getMemberContent(),
  ]);
  const trainingLocation = normalizeTrainingLocation(
    enrollments[primaryProgram?.slug ?? "adult"]?.trainingLocation,
  );

  const schedulePreview = schedulePreviewForEmail(profile?.email);
  // Default: yesterday · today · tomorrow. Ali has a TEMP 14-day preview.
  const dayWindow = primaryProgram
    ? await buildMemberDayWindow(uid, primaryProgram.slug, loggedSet, {
        rollingDays: schedulePreview ? previewRollingDays(schedulePreview) : 3,
        daysBefore: schedulePreview?.daysBefore ?? 1,
        upcomingDays: schedulePreview?.upcomingDays,
        futureVisibility: schedulePreview?.futureVisibility,
        loggedCalendarDates: loggedDates,
      })
    : null;

  const programBlock = dayWindow?.block ?? null;
  const programTodayKey = dayWindow?.programTodayKey ?? calendarToday;
  const rawViewDate = sp.date || programTodayKey;
  const intakeComplete =
    !uid.startsWith("member-") || isCoachIntakeComplete(profile);
  const latestMeasures = await listUserMeasurements(uid, 1);
  const lastMeasuredIso = isoDateFromTimestamp(latestMeasures[0]?.measuredAt ?? null);
  const measurementSchedule = resolveMeasurementDay({
    intakeComplete,
    lastMeasuredIso,
    todayIso: calendarToday,
  });
  const measurementCompletedToday = lastMeasuredIso === calendarToday;
  const warmupWorkout = !intakeComplete
    ? buildWarmupWorkoutView(memberName, coachSettings.warmupBlocks)
    : null;
  const intakeRampDays =
    !intakeComplete && warmupWorkout && !(dayWindow?.days.length)
      ? buildIntakeRampPlaceholderDays(calendarToday, 3, 1)
      : null;
  // Always expose real yesterday · today · tomorrow chips — even with no workout assigned.
  const calendarSwipeDays = buildCalendarSwipeDays(programTodayKey, loggedDates);
  const rawMemberDays = markDaysCompleted(
    dayWindow?.days.length
      ? dayWindow.days
      : intakeRampDays?.length
        ? intakeRampDays
        : calendarSwipeDays,
    loggedSet,
    loggedDates,
  );
  const finisherDates = rawMemberDays
    .map((d) => d.calendarDate || (/^\d{4}-\d{2}-\d{2}$/.test(d.iso) ? d.iso : ""))
    .filter(Boolean);
  const finishersByDate = await listFinishersByCalendarDates(finisherDates);
  const memberDays = attachFinisherNames(rawMemberDays, finishersByDate);
  const memberRollup = memberDays.length ? rollupForMemberDays(memberDays) : null;
  // Clamp deep-links outside the 3-day window back to program today.
  const allowedIsos = new Set(memberDays.map((d) => d.iso));
  const viewDate = allowedIsos.has(rawViewDate) ? rawViewDate : programTodayKey;

  const partIndexRaw = sp.part ? Number(sp.part) : undefined;
  const partIndex =
    partIndexRaw && Number.isFinite(partIndexRaw) && partIndexRaw >= 1
      ? Math.floor(partIndexRaw)
      : undefined;
  const todayWorkout = await resolveTodayPageWorkout(uid, viewDate, memberName, {
    partIndex,
  });
  let { session, workout, programSlug, source, scheduleLabel, parts, activePartIndex } =
    todayWorkout;
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
          : schedulePreview
            ? `Preview · ${schedulePreview.upcomingDays} days ahead (temp content review)`
            : "Swipe yesterday · today · tomorrow — only 3 days.";

  const selectedSummary = memberDays.find((d) => d.iso === viewDate) ?? null;
  if (!workout && selectedSummary?.workoutId) {
    workout = await getMemberWorkoutById(selectedSummary.workoutId, {
      userId: uid,
      memberName,
    });
    if (workout) source = source ?? "program";
  }
  const hasWorkout = !!workout;
  const stretchPreview = memberDays.length ? nextDayStretchPreview(memberDays, programTodayKey) : [];
  const tomorrowDay = memberDays.length ? nextMemberDay(memberDays, programTodayKey) : null;
  // Today and yesterday may run the full workout; tomorrow is preview only.
  const yesterdayIso = toIsoDate(
    (() => {
      const d = new Date(`${programTodayKey}T12:00:00`);
      d.setDate(d.getDate() - 1);
      return d;
    })(),
  );
  const canStartThisDate = viewDate === programTodayKey || viewDate === yesterdayIso;
  const canPreviewThisDate = Boolean(schedulePreview && workout && allowedIsos.has(viewDate));
  const memberWorkout = canStartThisDate || canPreviewThisDate ? workout : null;
  const isLateCatchUp = viewDate === yesterdayIso;
  const clampedViewDate = viewDate;

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

  let freePoolPinned: boolean | undefined;
  let curatedMode: boolean | undefined;
  let contentTierMin: string | null | undefined;
  if (primaryProgram && selectedSummary) {
    try {
      const { getDayFreePoolFlags } = await import("@/lib/gamification-free-pool");
      const flags = await getDayFreePoolFlags(
        primaryProgram.slug,
        selectedSummary.weekNumber,
        selectedSummary.dayNumber,
      );
      freePoolPinned = flags.freePoolPinned;
      curatedMode = flags.curatedMode;
      contentTierMin = flags.contentTierMin;
    } catch {
      /* ignore */
    }
  }

  const contentAccess = await resolveContentAccess({
    userId: uid,
    profilePlan: profile?.plan,
    enrollmentDay: enrollmentDayLinear ?? undefined,
    bypass: Boolean(asInstructor),
    freePoolPinned,
    curatedMode,
    contentTierMin,
  });

  const memberPlan = normalizeSignupPlan(profile?.plan);
  /** Business Class: 5 uses/mo included · Coach Class earn 5/mo · greyscale teaser otherwise. */
  const maintainAccess = !asInstructor
    ? await resolveMaintainAccess(uid, memberPlan)
    : null;
  // Coach Class+ (and anyone allowed) see the library list — locked rows stay greyed.
  const maintainList =
    maintainAccess &&
    (maintainAccess.allowed || canSeeMaintainTeaser(memberPlan))
      ? await listMaintainWorkouts()
      : [];
  const canOpenMaintain = Boolean(maintainAccess?.allowed);
  const maintainId = sp.maintain?.trim() || null;
  let maintainWorkout = null as Awaited<ReturnType<typeof getMemberWorkoutById>>;
  if (
    maintainId &&
    canOpenMaintain &&
    (await isMaintainWorkoutId(maintainId))
  ) {
    maintainWorkout = await getMemberWorkoutById(maintainId, {
      userId: uid,
      memberName,
    });
  }
  // Prefer maintain console when opened from the list.
  const consoleWorkout = maintainWorkout || memberWorkout;
  const consoleIsMaintain = Boolean(maintainWorkout);

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
              selectedDate={clampedViewDate}
              days={memberDays}
              rollup={memberRollup}
              selectedSummary={selectedSummary}
              nextStretchPreview={stretchPreview}
              tomorrowDay={tomorrowDay}
              workout={consoleWorkout}
              programSlug={consoleIsMaintain ? "maintain" : programSlug}
              trainingLocation={trainingLocation}
              targetUserId={uid}
              scheduleLabel={
                consoleIsMaintain ? "Quick maintain · not program day" : scheduleLabel
              }
              calendarDateLabel={formatDateLabel(clampedViewDate)}
              subtitle={
                consoleIsMaintain
                  ? "Quick maintain (5 uses / month) — log it when you finish."
                  : isLateCatchUp
                    ? "Catch-up day — finish yesterday’s workout (−20% score)."
                    : subtitle
              }
              dayParts={
                consoleIsMaintain ? undefined : parts && parts.length > 1 ? parts : undefined
              }
              activePartIndex={activePartIndex}
              hasCoachSession={!!session}
              intakeComplete={intakeComplete}
              warmupWorkout={warmupWorkout}
              introBookedAt={profile?.introBookedAt ?? null}
              coachMeetingRequestedAt={profile?.coachMeetingRequestedAt ?? null}
              coachMeetingRequestNote={profile?.coachMeetingRequestNote ?? null}
              autoPromptIntroBooking={
                coachSettings.autoPromptIntroBooking || !profile?.introBookedAt
              }
              autoPromptFollowUpBooking={coachSettings.autoPromptFollowUpBooking}
              programBlock={programBlock}
              contentAccess={
                consoleIsMaintain ? null : asInstructor ? null : contentAccess
              }
              isLateCatchUp={consoleIsMaintain ? false : isLateCatchUp}
              maintainWorkouts={maintainList}
              activeMaintainId={maintainId}
              maintainAccess={maintainAccess}
              forceShowWorkout={consoleIsMaintain || canPreviewThisDate}
              schedulePreviewChips={schedulePreview?.visibleChips}
              previewFutureReadOnly={Boolean(schedulePreview && !canStartThisDate && canPreviewThisDate)}
              measurementDay={measurementSchedule.kind === "today" || measurementSchedule.kind === "tomorrow" ? measurementSchedule.kind : null}
              measurementCompletedToday={measurementCompletedToday}
              firstTimeOnSite={
                firstTimeOnSite && finishedSetupThisVisit(profile?.completedAt)
              }
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

          <MemberTodayHub
            dashboard={dashboard}
            maintainAccess={maintainAccess}
          />
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
                  <summary className="flex items-center gap-2 cursor-pointer list-none text-[var(--muted)] hover:text-[var(--text)]">
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
                liveSessionDate={
                  selectedSummary?.calendarDate ||
                  (/^\d{4}-\d{2}-\d{2}$/.test(viewDate) ? viewDate : calendarToday)
                }
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