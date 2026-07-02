import Link from "next/link";
import CoachLessonPlanBuilder from "@/components/CoachLessonPlanBuilder";
import CoachDayView from "@/components/CoachDayView";
import { buildCoachDayPlan } from "@/lib/coach-day";
import { hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { listCoachMembersForUi } from "@/lib/sms";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function AdminPlanPage({ searchParams }: Props) {
  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const sp = await searchParams;
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = sp.date || todayKey;
  const dayPlan = await buildCoachDayPlan(sessionDate);
  const coachMembers = (await listCoachMembersForUi()).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  const prevDate = new Date(`${sessionDate}T12:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(`${sessionDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const prevKey = prevDate.toISOString().slice(0, 10);
  const nextKey = nextDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/day" className="text-xs text-accent hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Plan a workout</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Write or paste a lesson plan — Grok interprets it, asks questions if needed, then you cascade
          it to your class or fork individuals with special needs.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/plan?date=${prevKey}`} className="btn-ghost px-2 py-1 text-xs">
            ← Prev
          </Link>
          <span className="font-medium">{formatDateLabel(sessionDate)}</span>
          <Link href={`/admin/plan?date=${nextKey}`} className="btn-ghost px-2 py-1 text-xs">
            Next →
          </Link>
          {sessionDate !== todayKey && (
            <Link href="/admin/plan" className="text-xs text-accent hover:underline ml-2">
              Back to today
            </Link>
          )}
        </div>
        <Link href={`/admin/today?date=${sessionDate}`} className="text-xs text-accent hover:underline">
          Go to Today schedule →
        </Link>
      </div>

      <CoachLessonPlanBuilder
        key={sessionDate}
        sessionDate={sessionDate}
        viewDateLabel={formatDateLabel(sessionDate)}
        memberOptions={coachMembers}
        savedSessions={dayPlan.sessions}
        defaultTime="06:30"
      />

      <details className="group card">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-sm">
          <span className="text-accent group-open:rotate-90 transition-transform text-xs">▶</span>
          Today&apos;s schedule ({dayPlan.assignedCount} assigned)
        </summary>
        <div className="mt-4">
          <CoachDayView day={dayPlan} dateQuery={sessionDate} />
        </div>
      </details>
    </div>
  );
}