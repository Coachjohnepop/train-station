import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramAccessState } from "@/lib/access";
import { DAY_LABELS } from "@/lib/program-constants";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";
import { syncProgramSchedule } from "@/lib/program-schedule";
import { prisma } from "@/lib/prisma";
import EnrollButton from "@/components/EnrollButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function MemberProgramPage({ params }: Props) {
  const { slug } = await params;
  const [dashboard, programRecord] = await Promise.all([
    getMemberDashboard(),
    prisma.program.findUnique({ where: { slug } }),
  ]);

  if (!dashboard || !programRecord) notFound();

  const isEnrolled = dashboard.enrollments.some(
    (e) => e.program.slug === slug
  );

  const accessState = getProgramAccessState(programRecord, dashboard.access);
  if (accessState === "upgrade" && !dashboard.access.isPreview) {
    notFound();
  }

  await syncProgramSchedule(programRecord.id);
  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  // All days in the program (for structure view)
  const allDays = program.weeks.flatMap((w) => w.days);

  // Only days that have a workout assigned
  const assignedDays = allDays.filter((d) => d.workout);

  // Compute which workouts in this program the member has logged (for checkmarks)
  const workoutIdsInProgram = assignedDays.map((d) => d.workout!.id);
  const loggedSet = new Set<string>();
  if (workoutIdsInProgram.length > 0) {
    const logs = await prisma.workoutLog.findMany({
      where: {
        userId: dashboard.user.id,
        workoutId: { in: workoutIdsInProgram },
      },
      select: { workoutId: true },
    });
    logs.forEach((l) => loggedSet.add(l.workoutId));
  }

  const totalAssigned = assignedDays.length;
  const completedCount = assignedDays.filter((d) => loggedSet.has(d.workout!.id)).length;

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
            <span>{completedCount} / {totalAssigned} days logged</span>
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

      {!isEnrolled && (
        <div className="mt-6 card border-accent bg-accent-muted">
          <p className="font-medium mb-3">
            Enroll for free to unlock progress tracking, silhouettes, and your personal schedule.
          </p>
          <EnrollButton slug={slug} isEnrolled={false} />
        </div>
      )}

      <div className="mt-6 space-y-6">
        {program.weeks.map((week) => (
          <section key={week.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Week {week.weekNumber}
            </h2>
            <ul className="mt-3 space-y-2">
              {week.days
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((day) => {
                  const label =
                    DAY_LABELS[day.dayNumber - 1] ?? `Day ${day.dayNumber}`;
                  if (day.workout) {
                    const wid = day.workout.id;
                    const isDone = loggedSet.has(wid);
                    return (
                      <li key={day.id}>
                        <Link
                          href={`/member/workout?workoutId=${encodeURIComponent(
                            wid
                          )}&program=${encodeURIComponent(program.slug)}`}
                          className={`card flex items-center justify-between gap-3 transition hover-accent-border ${
                            isDone ? "border-[var(--success)]/30" : ""
                          }`}
                        >
                          <div>
                            <span className="text-xs text-[var(--muted)]">
                              {label}
                            </span>
                            <p className="mt-1 font-medium">
                              {day.workout.name}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                            {isDone && (
                              <span
                                className="text-[var(--success)]"
                                aria-label="Completed"
                              >
                                ✓
                              </span>
                            )}
                            <span
                              className={
                                isDone ? "text-[var(--success)]" : "text-accent"
                              }
                            >
                              {isDone ? "Review" : "Start →"}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  } else {
                    return (
                      <li
                        key={day.id}
                        className="card flex items-center justify-between gap-3 opacity-70"
                      >
                        <div>
                          <span className="text-xs text-[var(--muted)]">
                            {label}
                          </span>
                          <p className="mt-1 font-medium text-[var(--muted)]">
                            To be announced
                          </p>
                        </div>
                        <span className="text-xs text-[var(--muted)]">
                          Coming soon
                        </span>
                      </li>
                    );
                  }
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}