import Link from "next/link";
import MemberProgramSchedule from "@/components/MemberProgramSchedule";
import MemberReminderSettings from "@/components/MemberReminderSettings";
import { getProgramBySlug } from "@/lib/program-data";
import type { MemberDashboardData } from "@/lib/member-context";

type Props = {
  dashboard: MemberDashboardData;
  loggedWorkoutIds: string[];
};

export default async function MemberTodayHub({ dashboard, loggedWorkoutIds }: Props) {
  const { enrollments, stats } = dashboard;

  const scheduleEnrollments = enrollments.filter((e) => {
    const cat = e.program.category || "workout";
    return cat === "workout" || cat === "journey" || cat === "yoga";
  });

  const enrolledProgramsWithSchedule = (
    await Promise.all(
      scheduleEnrollments.map(async (enrollment) => {
        const program = await getProgramBySlug(enrollment.program.slug);
        if (!program) return null;
        return { enrollment, program };
      }),
    )
  ).filter(Boolean) as Array<{
    enrollment: (typeof enrollments)[number];
    program: NonNullable<Awaited<ReturnType<typeof getProgramBySlug>>>;
  }>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/member/chat"
          className="card flex flex-col gap-1 p-3 transition hover-accent-border"
        >
          <p className="text-sm font-semibold">Coach messages</p>
          <p className="text-xs text-[var(--muted)]">
            Text your coach, get accountability nudges, and see program updates.
          </p>
          <span className="mt-1 text-xs font-medium text-accent">Open messages →</span>
        </Link>

        {enrollments.length > 0 ? (
          <div className="card p-3">
            <p className="text-sm font-semibold mb-2">Your program{enrollments.length > 1 ? "s" : ""}</p>
            <ul className="space-y-1">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{e.program.name}</span>
                  <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                    W{e.currentWeek}D{e.currentDay}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card p-3 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--text)]">Program enrollment</p>
            <p className="mt-1 text-xs">
              Your coach will add you to your community program. Check messages for updates.
            </p>
          </div>
        )}

        <div className="card flex items-center gap-4 p-3">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-accent">{stats.dayStreak}</p>
            <p className="text-[10px] text-[var(--muted)]">day streak</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{stats.totalWorkouts}</p>
            <p className="text-[10px] text-[var(--muted)]">logged</p>
          </div>
          <Link href="/member/account" className="ml-auto text-xs text-accent hover:underline">
            Account →
          </Link>
        </div>
      </div>

      {enrollments.length > 0 && (
        <div className="card p-3">
          <MemberReminderSettings />
        </div>
      )}

      {enrolledProgramsWithSchedule.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Your 3-week window</h2>
            <p className="text-[10px] text-[var(--muted)]">
              Past, present, and upcoming sessions for your enrolled program — not the full catalog.
            </p>
          </div>
          {enrolledProgramsWithSchedule.map(({ enrollment, program }) => (
            <div key={enrollment.id} className="space-y-2">
              <p className="text-sm font-medium">{program.name}</p>
              <MemberProgramSchedule
                program={program}
                curWeek={enrollment.currentWeek}
                curDay={enrollment.currentDay}
                loggedWorkoutIds={loggedWorkoutIds}
                idPrefix={`today-${program.slug}-`}
                compact
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}