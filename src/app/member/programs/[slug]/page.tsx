import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProgramAccessState } from "@/lib/access";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";
import MemberProgramSchedule from "@/components/MemberProgramSchedule";
import { resolveUserId } from "@/lib/current-user";
import { loadMemberLoggedWorkoutIds, computeScheduleProgress } from "@/lib/member-schedule";
import { buildMemberDayWindow } from "@/lib/member-day-window";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ asInstructor?: string; forUser?: string }>;
};

export default async function MemberProgramPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const isCoachView = !!sp.asInstructor;
  const forUser = sp.forUser;

  const dashboard = await getMemberDashboard();
  const programRecord = await getProgramBySlug(slug);

  if (!dashboard || !programRecord) notFound();

  const isEnrolled = dashboard.enrollments.some((e) => e.program.slug === slug);

  if (!isEnrolled && !isCoachView) {
    redirect("/member/today");
  }

  const accessState = getProgramAccessState(programRecord, dashboard.access);
  if (accessState === "upgrade" && !dashboard.access.isPreview) {
    notFound();
  }

  const program = programRecord;
  const cat = (program.category || "workout") as "workout" | "eating" | "yoga" | "journey";
  const isWorkout = cat === "workout";

  const thisEnroll = dashboard.enrollments.find((e) => e.program.slug === slug);
  const curWeek = thisEnroll?.currentWeek || 1;
  const curDay = thisEnroll?.currentDay || 1;

  const uid = await resolveUserId();
  const loggedSet = await loadMemberLoggedWorkoutIds(uid);
  const { totalAssigned, completedCount } = computeScheduleProgress(
    program,
    curWeek,
    curDay,
    loggedSet,
    isWorkout,
  );

  return (
    <div>
      <Link href="/member/today" className="text-xs text-accent hover:underline">
        ← Go to Today
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{program.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{program.description}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {isCoachView
          ? `${program.durationWeeks}-week plan · enrolled program`
          : "Your 28-day month · enrolled program"}
      </p>
      {totalAssigned > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs font-medium text-accent mb-1">
            <span>
              {completedCount} / {totalAssigned}{" "}
              {isWorkout ? "workouts" : cat === "journey" ? "sessions" : "sessions"} logged
            </span>
            <span>{Math.round((completedCount / totalAssigned) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.round((completedCount / totalAssigned) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {isCoachView && cat === "eating" && (
        <div className="mt-3 p-3 rounded border border-amber-500/30 bg-amber-500/10 text-sm">
          <strong>Instructor Coaching Mode</strong> — Eating Report for the student.
          {forUser && ` (Student: ${forUser})`}
        </div>
      )}

      {cat === "eating" && isCoachView && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-1">Eating Report — {program.name}</h2>
          <p className="text-sm text-[var(--muted)]">
            Eating Approaches are coming soon. This will be a simple daily report of what the student logged as eaten
            (meals, protein targets, notes).
          </p>
          <div className="mt-2 text-xs">
            <Link
              href={`/member/prompts?program=${slug}&cat=eating&asInstructor=true&forUser=${forUser || ""}`}
              className="text-accent hover:underline"
            >
              View eating report placeholder →
            </Link>
          </div>
        </div>
      )}

      {!(cat === "eating" && isCoachView) && (
        <div className="mt-6">
          {isCoachView ? (
            <MemberProgramSchedule
              program={program}
              curWeek={curWeek}
              curDay={curDay}
              loggedWorkoutIds={[...loggedSet]}
              idPrefix={`${slug}-`}
              showFullSchedule
            />
          ) : (
            <MemberPersonalMonth slug={slug} userId={uid} loggedSet={loggedSet} />
          )}
        </div>
      )}
    </div>
  );
}

async function MemberPersonalMonth({
  slug,
  userId,
  loggedSet,
}: {
  slug: string;
  userId: string;
  loggedSet: Set<string>;
}) {
  const window = await buildMemberDayWindow(userId, slug, loggedSet);
  const days = window?.days ?? [];
  if (!days.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Your 28-day month starts on Today.{" "}
        <Link href="/member/today" className="text-accent hover:underline">
          Go to Today →
        </Link>
      </p>
    );
  }

  const start = days[0]?.calendarDate;
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--muted)]">
        Your 28-day month
        {start ? ` · Day 1 is ${start}` : ""}. This is not the gym class calendar.
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {days.map((day) => (
          <li key={day.iso}>
            <Link
              href={`/member/today?date=${encodeURIComponent(day.iso)}`}
              className={`card flex flex-col gap-0.5 p-3 transition hover-accent-border ${
                day.phase === "today" ? "ring-2 ring-accent/50" : ""
              }`}
            >
              <span className="text-[10px] text-[var(--muted)]">
                {day.dayLabel}
                {day.calendarDate ? ` · ${day.shortDate}` : ""}
                {day.phase === "today" ? " · today" : ""}
                {day.completed ? " · done" : ""}
              </span>
              <p className="text-sm font-medium truncate">
                {day.workoutName || (day.hasWorkout ? "Workout" : "Rest")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}