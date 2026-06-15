import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProgramAccessState,
} from "@/lib/access";
import { getMemberDashboard } from "@/lib/member-context";
import { getProgramBySlug } from "@/lib/program-data";
import EnrollButton from "@/components/EnrollButton";
import { PROGRAM_IMAGES } from "@/lib/program-constants";
import MemberHomeEquipment from '../../components/MemberHomeEquipment';
import MemberReminderSettings from '../../components/MemberReminderSettings';
import GoToTodayCard from "@/components/GoToTodayCard";
import MemberProgramSchedule from "@/components/MemberProgramSchedule";
import { resolveUserId } from "@/lib/current-user";
import { memberTodayHref, resolveMemberSession } from "@/lib/member-today";
import { loadMemberLoggedWorkoutIds } from "@/lib/member-schedule";

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage() {
  const data = await getMemberDashboard();
  if (!data) notFound();

  const { access, stats, enrollments, programs, continueUrl, continueLabel, activeContinues } =
    data;

  const uid = await resolveUserId();
  const [todaySession, loggedSet] = await Promise.all([
    resolveMemberSession(uid),
    loadMemberLoggedWorkoutIds(uid),
  ]);

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
  const todaySubtitle = todaySession
    ? `${todaySession.title} — ${new Date(todaySession.scheduledAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : undefined;

  const enrolledSlugs = new Set(enrollments.map((e) => e.program.slug));

  const CATEGORY_ORDER = ["workout", "yoga", "journey"] as const; // eating temporarily disabled (coming soon)
  const CATEGORY_LABELS: Record<string, string> = {
    workout: "Workouts",
    // eating: "Eating Approaches", // coming soon
    yoga: "Yoga Channels",
    journey: "Journeys",
  };

  const groupedPrograms = programs.reduce((acc: Record<string, any[]>, p: any) => {
    const cat = (p.category || "workout") as string;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4 lg:space-y-3">
      <section className="mb-1 lg:mb-0">
        <h1 className="text-xl lg:text-2xl font-bold">Dashboard</h1>
        <p className="mt-0.5 text-xs lg:text-sm text-[var(--muted)]">
          Your training hub — everything is open while we finish billing setup.
        </p>
      </section>

      {/* Top stratum: today, enrolled, metrics, continue */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-2 lg:items-stretch">
        <div className="lg:w-56 lg:flex-shrink-0">
          <div className="text-sm font-medium mb-2">Today</div>
          <GoToTodayCard
            href={memberTodayHref(todaySession)}
            appointmentCount={todaySession ? 1 : 0}
            subtitle={todaySubtitle}
            variant="member"
            compact
          />
        </div>
        {/* Enrolled section on the left (includes SMS reminders now) */}
        {enrollments.length > 0 && (
          <div className="lg:w-72 lg:flex-shrink-0">
            <div className="text-sm font-medium mb-2">Enrolled</div>
            <div className="space-y-1">
              {enrollments.map((e) => (
                <Link
                  key={e.id}
                  href={`/member/programs/${e.program.slug}`}
                  className="card flex items-center justify-between py-1 px-2 text-sm transition hover-accent-border"
                >
                  <span className="font-medium truncate">{e.program.name}</span>
                  <span className="text-xs text-[var(--muted)] ml-2 whitespace-nowrap">W{e.currentWeek}D{e.currentDay}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4">
              <MemberReminderSettings />
            </div>
          </div>
        )}

        {/* Metrics — streak emphasized at top per client feedback ("your streak should be at the very top") */}
        <div className="flex-shrink-0 lg:w-48">
          <div className="text-sm font-medium mb-2">Metrics</div>
          <div className="flex flex-col gap-2">
            {/* Streak first + slightly stronger visual */}
            <div className="card flex flex-col items-center text-center py-2.5 px-3 ring-1 ring-accent/30">
              <p className="text-3xl font-bold tabular-nums leading-none text-accent">{stats.dayStreak}</p>
              <p className="mt-0.5 text-xs font-semibold">Day streak</p>
              <p className="text-[9px] text-[var(--muted)]">consecutive training days</p>
            </div>
            <div className="card flex flex-col items-center text-center py-2 px-3">
              <p className="text-2xl font-bold tabular-nums leading-none">{stats.totalWorkouts}</p>
              <p className="mt-0.5 text-xs font-medium">Workouts logged</p>
              <p className="text-[9px] text-[var(--muted)]">total sessions completed</p>
            </div>
            <div className="card flex flex-col items-center text-center py-2 px-3">
              <p className="text-2xl font-bold tabular-nums leading-none">{stats.strengthScore || 0}</p>
              <p className="mt-0.5 text-xs font-medium">Strength Score</p>
              <p className="text-[9px] text-[var(--muted)]">est. bench 6RM (lbs) — see below</p>
              {stats.strengthScore > 0 ? (
                <p className="text-[9px] text-accent mt-1">Top 15% of demo athletes — log more to climb the ranks!</p>
              ) : (
                <p className="text-[9px] text-accent mt-1">Log lifts to rank vs other demo athletes</p>
              )}
            </div>
          </div>
        </div>

        {/* Continue training - supports doing workouts + eating + yoga in parallel. */}
        {(activeContinues && activeContinues.length > 0) || (continueUrl && continueLabel) ? (
          <div className="flex-1">
            <div className="text-sm font-medium mb-2">Continue Per Program</div>
            {activeContinues && activeContinues.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {activeContinues.map((c: any, idx: number) => (
                  <Link
                    key={idx}
                    href={c.url}
                    className="card block card-accent-frame bg-accent-muted transition hover-accent-border py-1 px-2 text-sm"
                  >
                    <span className="font-semibold">{c.label}</span> <span className="text-accent">→</span>
                  </Link>
                ))}
              </div>
            ) : (continueUrl && continueLabel ? (
              <Link href={continueUrl} className="card block card-accent-frame bg-accent-muted transition hover-accent-border py-1.5 px-3 text-sm">
                <span className="font-semibold">Continue:</span> {continueLabel} <span className="text-accent">→</span>
              </Link>
            ) : null)}
          </div>
        ) : null}
      </div>

      {enrolledProgramsWithSchedule.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Your schedule</h2>
              <p className="text-[10px] text-[var(--muted)]">
                This week is always visible. Expand full schedule only when you need other weeks.
              </p>
            </div>
            <Link href="/member/today" className="text-xs text-accent hover:underline whitespace-nowrap">
              Go to Today →
            </Link>
          </div>
          {enrolledProgramsWithSchedule.map(({ enrollment, program }) => (
            <div key={enrollment.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/member/programs/${program.slug}`}
                  className="text-sm font-medium hover:text-accent transition"
                >
                  {program.name}
                </Link>
                <span className="text-xs text-[var(--muted)]">
                  W{enrollment.currentWeek}D{enrollment.currentDay}
                </span>
              </div>
              <MemberProgramSchedule
                program={program}
                curWeek={enrollment.currentWeek}
                curDay={enrollment.currentDay}
                loggedWorkoutIds={[...loggedSet]}
                idPrefix={`dash-${program.slug}-`}
                compact
              />
            </div>
          ))}
        </section>
      )}

      {/* "Down here, you can have workouts logged" + ranking amongst users (from transcript feedback) */}
      <div className="card py-2 px-3 text-xs mb-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">Workouts logged:</span>
          <span className="tabular-nums font-semibold">{stats.totalWorkouts}</span>
          <span className="text-[var(--muted)]">total • history populates from console logs</span>
        </div>
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Your recent sessions and personal bests will list here. Strength score and ranking (vs other demo athletes) update automatically as you log key lifts in workouts.
        </p>
        {stats.totalWorkouts === 0 && (
          <>
            <p className="mt-1 text-[10px] text-accent">Start with any program preview or enroll to log your first session and see your rank climb.</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px]">
              <Link href="/member/programs" className="text-accent hover:underline">Browse programs &amp; enroll →</Link>
              <Link href="/member/workout" className="text-accent hover:underline">Open workout logger →</Link>
            </div>
          </>
        )}
      </div>

      <section>
        <details className="group">
          <summary className="flex items-center justify-between mb-2 cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)] group-open:text-white transition">
                Programs
              </h2>
              <span className="text-xs text-accent group-open:rotate-90 transition">▶</span>
            </div>
            <a href="/member/programs" className="text-xs text-accent hover:underline">
              View all
            </a>
          </summary>
          <p className="text-[10px] text-[var(--muted)] mb-3">Higher-level menu: Workouts • Yoga Channels • Journeys (chronicle recorded live sessions; substitute matching days into your workouts). <span className="text-[var(--accent)]">Eating Approaches: coming soon</span></p>

          {CATEGORY_ORDER.map((cat) => {
            const progs = groupedPrograms[cat] || [];
            if (progs.length === 0) return null;
            return (
              <div key={cat} className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase tracking-[1px] font-semibold text-[var(--accent)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">({progs.length})</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {progs.map((program: any) => {
                  const state = getProgramAccessState(program, access);
                  const locked = state === "upgrade";
                  const img = PROGRAM_IMAGES[program.slug] || "/images/programs/adult.jpg";
                  const isEnrolled = enrolledSlugs.has(program.slug);
                  const countLabel = cat === "workout" ? `${program.workoutCount || 0} workouts` : cat === "yoga" ? "Channel • flows & sessions" : "Recorded sessions • sub into workouts"; // eating coming soon
                  const actionLabel = isEnrolled ? "Review & track →" : "Preview →";

                  return (
                    <div
                      key={program.id}
                      className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--accent)] hover:shadow-xl ${locked ? "opacity-60" : ""}`}
                    >
                      <Link href={`/member/programs/${program.slug}`} className="block">
                        <div className="relative aspect-[16/9] w-full overflow-hidden">
                          <img
                            src={img}
                            alt={program.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 p-4">
                            <h3 className="mt-1 text-xl font-semibold text-white">{program.name}</h3>
                          </div>
                        </div>

                        <div className="p-4 pr-20">
                          {program.description && (
                            <p className="text-sm text-[var(--muted)] line-clamp-2">
                              {program.description}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {countLabel}
                          </p>
                          <div className="mt-1 text-[10px] text-accent group-hover:underline">
                            {actionLabel}
                          </div>
                        </div>
                      </Link>

                      {/* Enroll / Unenroll as clear button in bottom right */}
                      <div className="absolute bottom-3 right-3 z-10">
                        <EnrollButton
                          slug={program.slug}
                          isEnrolled={isEnrolled}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </details>
      </section>

      <details className="group">
        <summary className="flex items-center gap-2 mb-2 cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-[var(--muted)] group-open:text-white transition">
          Quick actions <span className="text-xs text-accent group-open:rotate-90 transition">▶</span>
        </summary>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          <Link
            href="/member/live"
            className="card transition hover-accent-border"
          >
            <p className="font-medium">Live sessions</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Book coach-led live training.
            </p>
            <span className="mt-2 inline-block text-xs text-accent">
              Open (preview) →
            </span>
          </Link>
        </section>

        {!access.isPreview && (
          <p className="text-center text-xs text-[var(--muted)] mt-2">
            Upgrade to 1st Class for live sessions (Coach tier is on-demand only).
          </p>
        )}
      </details>

      {/* Home equipment inventory moved to bottom (users set this in signup wizard; editable later as they acquire gear) */}
      <MemberHomeEquipment />

      {/* Collapsible strength explanation moved to bottom */}
      <details className="group mb-2">
        <summary className="flex items-center gap-2 cursor-pointer list-none text-[10px] text-[var(--muted)] -mt-1 mb-1 hover:text-[var(--text)]">
          <span>Strength Score calculation details</span>
          <span className="text-accent group-open:rotate-90 transition">▶</span>
        </summary>
        <p className="text-[10px] text-[var(--muted)]">
          Strength Score (power score): no upper limit. Computed from your best logged performances (weight × reps factor via Epley 1RM estimator then ~6RM) on key lifts. Each lift is converted to an estimated "bench press 6-rep max equivalent" using standard strength ratios (squat ~1.5× bench, OHP/military ~0.65×, DB bench ~0.9× total, rows/pulldowns ~0.85-1.1×, triceps extensions ~0.4×). The score is the average of those bench-equivalents across the lifts you have data for (Back Squat, Bench Press, DB Bench, Military/Shoulder Press, Pulldown/Row, Tricep work). Log more volume on these to raise it.
        </p>
      </details>
    </div>
  );
}