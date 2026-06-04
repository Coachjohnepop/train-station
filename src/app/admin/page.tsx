import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Force dynamic so build succeeds without a live DB (Vercel build will have DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [exercises, workouts, programs, users] = await Promise.all([
    prisma.exercise.count(),
    prisma.workout.count(),
    prisma.program.count(),
    prisma.user.count(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Coach dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Build content bottom-up: exercises → workouts → programs.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <StatCard label="Exercises" value={exercises} href="/admin/exercises" />
        <StatCard label="Workouts" value={workouts} href="/admin/workouts" />
        <StatCard label="Programs" value={programs} href="/admin/programs" />
        <StatCard label="Users" value={users} href="/admin/users" />
      </div>
      <div className="card mt-8">
        <h2 className="font-semibold">Recommended workflow</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>Add movements to the exercise library (video links optional).</li>
          <li>Assemble workouts from the library — sets/reps in one table.</li>
          <li>Schedule workouts across program weeks (programs page next).</li>
          <li>Manage users (roles: admin / instructor / member / prospective) and approve applications.</li>
          <li>Publish and connect Stripe when keys are ready.</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="card transition hover-accent-border">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </Link>
  );
}