import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProgramAccessState,
} from "@/lib/access";
import { getMemberDashboard } from "@/lib/member-context";
import EnrollButton from "@/components/EnrollButton";

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage() {
  const data = await getMemberDashboard();
  if (!data) notFound();

  const { access, stats, enrollments, programs, continueUrl, continueLabel } =
    data;

  const enrolledSlugs = new Set(enrollments.map((e) => e.program.slug));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your training hub — everything is open while we finish billing setup.
        </p>
      </section>

      {continueUrl && continueLabel && (
        <Link href={continueUrl} className="card block card-accent-frame bg-accent-muted transition hover-accent-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Continue training
          </p>
          <p className="mt-2 text-lg font-semibold">{continueLabel}</p>
          <p className="mt-2 text-sm text-accent">Resume →</p>
        </Link>
      )}

      <section className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.dayStreak}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Day streak</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Logged</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold">{stats.scheduledThisWeek}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">In programs</p>
        </div>
      </section>

      {enrollments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Active programs
          </h2>
          <ul className="mt-3 space-y-2">
            {enrollments.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/member/programs/${e.program.slug}`}
                  className="card flex items-center justify-between transition hover-accent-border"
                >
                  <div>
                    <p className="font-medium">{e.program.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Week {e.currentWeek} · Day {e.currentDay}
                    </p>
                  </div>
                  <span className="text-accent">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            All programs
          </h2>
          <Link href="/member/programs" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const state = getProgramAccessState(program, access);
            const locked = state === "upgrade";
            const img = {
              adult: "/images/programs/adult.jpg",
              "strength-training": "/images/programs/strength.jpg",
              "boot-camp-preparation": "/images/programs/bootcamp.jpg",
              "combat-training": "/images/programs/combat.jpg",
              "youth-sports": "/images/programs/youth.jpg",
            }[program.slug] || "/images/programs/adult.jpg";
            const isEnrolled = enrolledSlugs.has(program.slug);
            return (
              <div
                key={program.id}
                className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--accent)] hover:shadow-xl ${locked ? "opacity-60" : ""}`}
              >
                <Link href={`/member/programs/${program.slug}`}>
                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <img
                      src={img}
                      alt={program.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-4">
                      <span className="inline-block rounded bg-[var(--success)]/90 px-2 py-0.5 text-[10px] font-medium text-white">
                        Included
                      </span>
                      <h3 className="mt-1 text-xl font-semibold text-white">{program.name}</h3>
                    </div>
                  </div>
                </Link>
                <div className="p-4">
                  {program.description && (
                    <p className="text-sm text-[var(--muted)] line-clamp-2">
                      {program.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {program.workoutCount} workouts scheduled
                  </p>
                  <div className="mt-3">
                    <EnrollButton
                      slug={program.slug}
                      isEnrolled={isEnrolled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/member/workout"
          className="card transition hover-accent-border"
        >
          <p className="font-medium">Today&apos;s workout</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Log sets with past-performance silhouettes.
          </p>
        </Link>
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
        <p className="text-center text-xs text-[var(--muted)]">
          Upgrade to 1st Class for premium programs and live sessions.
        </p>
      )}
    </div>
  );
}