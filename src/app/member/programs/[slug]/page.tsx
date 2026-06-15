import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramAccessState } from "@/lib/access";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";
import EnrollButton from "@/components/EnrollButton";
import MemberProgramSchedule from "@/components/MemberProgramSchedule";
import { resolveUserId } from "@/lib/current-user";
import { loadMemberLoggedWorkoutIds, computeScheduleProgress } from "@/lib/member-schedule";

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
      <Link href="/member/programs" className="text-xs text-accent hover:underline">
        ← Programs
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{program.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{program.description}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {program.durationWeeks}-week plan ·{" "}
        <span className="text-[var(--success)]">Full access</span>
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

      {!isEnrolled && (
        <div className="mt-6 card border-accent bg-accent-muted">
          <p className="font-medium mb-3">
            Enroll for free to unlock progress tracking, silhouettes, and your personal schedule.
          </p>
          <EnrollButton slug={slug} isEnrolled={false} />
        </div>
      )}

      {!(cat === "eating" && isCoachView) && (
        <div className="mt-6">
          <MemberProgramSchedule
            program={program}
            curWeek={curWeek}
            curDay={curDay}
            loggedWorkoutIds={[...loggedSet]}
            idPrefix={`${slug}-`}
          />
        </div>
      )}
    </div>
  );
}