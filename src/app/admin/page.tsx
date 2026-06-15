import Link from "next/link";
import GoToTodayCard from "@/components/GoToTodayCard";
import { getCoachTodaySummary } from "@/lib/today-appointments";

// Force dynamic so build succeeds without a live DB (Vercel build will have DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // stub counts for demo (no DB)
  const [exercises, workouts, programs, users] = [101, 31, 5, 5];
  const today = await getCoachTodaySummary();

  return (
    <div>
      <h1 className="text-2xl font-bold">Coach dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Build content bottom-up: exercises → workouts → programs.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <GoToTodayCard
          href="/admin/today"
          appointmentCount={today.count}
          variant="coach"
          subtitle={
            today.count > 0
              ? `${today.count} appt${today.count === 1 ? "" : "s"} today`
              : "Paste SMS · schedule"
          }
          statStyle
        />
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

      {/* Quick demo coach impersonation links — use these to test the "login as student" experience */}
      <div className="card mt-6 border border-accent/30">
        <h2 className="font-semibold text-accent">Demo: Coach view as student (impersonation)</h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          These simulate an instructor logging into one of their students' accounts from the admin/users list.
          Eating / diet features are coming soon (temporarily disabled).
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link 
            href="/admin/users" 
            className="btn-ghost text-xs px-3 py-1"
          >
            → Go to Users list (click "Coach Workout" on the demo member)
          </Link>
          <Link 
            href="/member/workout?asInstructor=true&forUser=demo@thetrainstation.co" 
            className="btn-ghost text-xs px-3 py-1"
          >
            Live workout coaching (as instructor)
          </Link>
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted)]">Eating Approaches: coming soon.</p>
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