import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import { getProgramAccessState } from "@/lib/access";
import { DAY_LABELS } from "@/lib/program-constants";
import { getProgramBySlug } from "@/lib/program-data";
import { getMemberDashboard } from "@/lib/member-context";
import EnrollButton from "@/components/EnrollButton";

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

  const isEnrolled = dashboard.enrollments.some(
    (e) => e.program.slug === slug
  );

  const accessState = getProgramAccessState(programRecord, dashboard.access);
  if (accessState === "upgrade" && !dashboard.access.isPreview) {
    notFound();
  }

  // await syncProgramSchedule(programRecord.id);
  const program = programRecord;
  if (!program) notFound();

  const cat = (program.category || "workout") as "workout" | "eating" | "yoga" | "journey";
  const isWorkout = cat === "workout";
  const isJourney = cat === "journey";

  // All days in the program (for structure view)
  const allDays = program.weeks.flatMap((w: any) => w.days);

  // Only days that have a workout assigned (for workout cats)
  const hasAssignedWorkout = (d: any) => d.workout || (d.options && d.options.length > 0);
  const assignedDays = isWorkout ? allDays.filter(hasAssignedWorkout) : allDays;

  // Get user's current position in this program (from dashboard enrollments)
  const thisEnroll = dashboard.enrollments.find((e: any) => e.program.slug === slug);
  const curWeek = thisEnroll?.currentWeek || 1;
  const curDay = thisEnroll?.currentDay || 1;

  // Load actually logged workoutIds for this demo user (so specific options show as done)
  const loggedSet = new Set<string>();
  const isDemo = process.env.DATABASE_URL?.includes("dummy") ?? true;
  if (isDemo) {
    try {
      const logsPath = path.join(process.cwd(), "prisma", "logs.dev.json");
      if (fs.existsSync(logsPath)) {
        const logsData = JSON.parse(fs.readFileSync(logsPath, "utf8"));
        (logsData.workoutLogs || []).forEach((log: any) => {
          if (log.userId === "demo-user" && log.workoutId) {
            loggedSet.add(log.workoutId);
          }
        });
      }
    } catch {}
  }

  const totalAssigned = assignedDays.length;

  // Completed count based on enrollment position (days before current are done)
  // plus any explicitly logged options (for the current day if just finished one option)
  let completedCount = 0;
  program.weeks.forEach((w: any) => {
    (w.days || []).forEach((d: any) => {
      if (isWorkout && !hasAssignedWorkout(d)) return;
      const dayBeforeCurrent = w.weekNumber < curWeek || (w.weekNumber === curWeek && (d.dayNumber || 0) < curDay);
      const hasLoggedOption = (d.options || []).some((o: any) => loggedSet.has(o.workoutId)) || (d.workoutId && loggedSet.has(d.workoutId));
      if (dayBeforeCurrent || hasLoggedOption) completedCount++;
    });
  });

  // Eating temporarily disabled (coming soon) - loads removed

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
            <span>{completedCount} / {totalAssigned} {isWorkout ? "workouts" : isJourney ? "sessions" : "sessions"} logged</span> {/* eating coming soon */}
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

      {/* Eating coach view: simple coming soon / report link (no workout schedule or assigning) */}
      {cat === "eating" && isCoachView && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-1">Eating Report — {program.name}</h2>
          <p className="text-sm text-[var(--muted)]">Eating Approaches are coming soon. This will be a simple daily report of what the student logged as eaten (meals, protein targets, notes).</p>
          <div className="mt-2 text-xs">
            <Link href={`/member/prompts?program=${slug}&cat=eating&asInstructor=true&forUser=${forUser || ''}`} className="text-accent hover:underline">
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

      {/* For eating in coach view, we do NOT show the week/day schedule or any workout assignment UI at all.
          Coach drill for eating is a pure report of logged eaten data only (see the Diet Drill Down section above). */}
      {!(cat === "eating" && isCoachView) && (
      <div className="mt-6 space-y-6">
        {program.weeks.map((week: any) => (
          <section key={week.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Week {week.weekNumber}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {week.days
                .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
                .map((day: any) => {
                  const label =
                    DAY_LABELS[day.dayNumber - 1] ?? `Day ${day.dayNumber}`;
                  if (isWorkout) {
                    const opts = (day.options && day.options.length > 0)
                      ? day.options
                      : (day.workout ? [{ workoutId: day.workout.id, label: "Standard", workout: day.workout }] : []);

                    if (opts.length === 0) return null;

                    const dayBeforeCurrent = week.weekNumber < curWeek || (week.weekNumber === curWeek && (day.dayNumber || 0) < curDay);
                    const hasLoggedOption = opts.some((o: any) => loggedSet.has(o.workoutId)) || (day.workoutId && loggedSet.has(day.workoutId));
                    const isDone = dayBeforeCurrent || hasLoggedOption;
                    const dayDone = isDone;

                    return (
                      <li key={day.id} className="space-y-1">
                        <div className="text-[10px] lg:text-xs text-[var(--muted)] truncate pl-1">{label}</div>

                        {opts.map((opt: any, idx: number) => {
                          const w = opt.workout || day.workout;
                          if (!w) return null;
                          const wid = opt.workoutId || w.id;
                          const isThisSessionDone = loggedSet.has(wid); // specific choice (Home/Gym) logged by member
                          const isHome = /home/i.test(opt.label || "");
                          const displayName = (opts.length > 1 ? `${opt.label}: ` : "") + (w.name.replace(/ \(Home\)| \(Gym\)/i, ""));
                          return (
                            <Link
                              key={idx}
                              href={`/member/workout?workoutId=${encodeURIComponent(wid)}&program=${encodeURIComponent(program.slug)}${opt.label ? `&option=${encodeURIComponent(opt.label)}` : ''}${isThisSessionDone ? '&review=true' : ''}`}
                              className={`card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-1 lg:gap-3 p-2 lg:p-3 transition hover-accent-border text-sm ${
                                isThisSessionDone 
                                  ? "ring-2 ring-[var(--success)] ring-offset-1 bg-[var(--success)]/5" 
                                  : dayDone 
                                    ? "border-[var(--success)]/30" 
                                    : ""
                              } ${isHome ? "border-blue-300 bg-blue-50/30" : ""}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="mt-0.5 lg:mt-1 font-medium truncate" title={displayName}>
                                  {displayName} {isHome && <span className="text-[10px] text-blue-600">(Home)</span>}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1 lg:gap-2 text-xs lg:text-sm font-medium whitespace-nowrap">
                                {isThisSessionDone && (
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white text-[9px]" aria-label="You did this session">✓</span>
                                )}
                                <span className={isThisSessionDone ? "text-[var(--success)] font-medium" : dayDone ? "text-[var(--success)]" : "text-accent"}>
                                  {isThisSessionDone ? "You did this" : dayDone ? "Review" : "Start →"}
                                </span>
                              </div>
                            </Link>
                          );
                        })}

                        {/* Substitution example for demo - shows embedded YouTube (editable by admin in journey program schedule) */}
                        {program.slug === "adult" && (
                          <div className={`text-[9px] mt-0.5 pl-1 ${dayDone ? "ring-1 ring-[var(--success)] p-1 rounded bg-[var(--success)]/5" : ""}`}>
                            {dayDone ? (
                              <span className="text-[var(--success)] font-medium">✓ You followed the John & Steph recording &amp; checklist for this day</span>
                            ) : (
                              <Link href={`/member/workout?program=${program.slug}&subJourney=john-steph&subDay=${day.dayNumber}`} className="text-accent hover:underline">or follow the full John & Steph recording &amp; checklist (day {day.dayNumber}) →</Link>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  } else if (isJourney) {
                    // journey: recorded live sessions with YT links (substitutable into workouts)
                    const journeyHref = `/member/journey?program=${encodeURIComponent(program.slug)}&day=${day.dayNumber}`;
                    const title = day.notes || day.videoUrl ? "Recorded live session" : "Journey session";
                    const sub = day.videoUrl ? " (substitutable)" : "";
                    return (
                      <li key={day.id}>
                        <Link
                          href={journeyHref}
                          className="card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-1 lg:gap-3 p-2 lg:p-3 transition hover-accent-border text-sm border-accent/30"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] lg:text-xs text-[var(--muted)] truncate">
                              {label}
                            </span>
                            <p className="mt-0.5 lg:mt-1 font-medium truncate" title={title}>
                              ▶ {title.length > 50 ? title.slice(0,47) + "..." : title}{sub}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 lg:gap-2 text-xs lg:text-sm font-medium whitespace-nowrap text-accent">
                            Watch recording →
                          </div>
                        </Link>
                      </li>
                    );
                  } else {
                    // eating or yoga: cascading prompts / channel content
                    // For coach diet view, the main overview above already shows the clean drill (prescription + actual intake)
                    // Day links still go to the detailed prompts page for that day
                    const promptHref = `/member/prompts?program=${encodeURIComponent(program.slug)}&day=${day.dayNumber}&cat=${cat}`;
                    const title = day.notes || (cat === "eating" ? "Daily eating prompts & tracking" : "Yoga flow / session");
                    const action = cat === "yoga" ? "Open channel" : "Start prompts";
                    return (
                      <li key={day.id}>
                        <Link
                          href={promptHref}
                          className="card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-1 lg:gap-3 p-2 lg:p-3 transition hover-accent-border text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] lg:text-xs text-[var(--muted)] truncate">
                              {label}
                            </span>
                            <p className="mt-0.5 lg:mt-1 font-medium truncate" title={title}>
                              {title.length > 60 ? title.slice(0,57) + "..." : title}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 lg:gap-2 text-xs lg:text-sm font-medium whitespace-nowrap text-accent">
                            {action} →
                          </div>
                        </Link>
                      </li>
                    );
                  }
                })}
            </ul>
          </section>
        ))}
      </div>
      )}
    </div>
  );
}