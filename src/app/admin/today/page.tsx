import Link from "next/link";
import TodaySessionPanel from "@/components/TodaySessionPanel";
import CoachDayView from "@/components/CoachDayView";
import { buildCoachDayPlan } from "@/lib/coach-day";
import { getTodaySessionByDate, hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { listDemoMembersForCoach } from "@/lib/sms";
import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function AdminTodayPage({ searchParams }: Props) {
  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const sp = await searchParams;
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = sp.date || todayKey;
  const session = getTodaySessionByDate(sessionDate);
  const dayPlan = await buildCoachDayPlan(sessionDate);
  const coachMembers = listDemoMembersForCoach().map((m) => ({
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
        <Link href="/admin" className="text-xs text-accent hover:underline">
          ← Coach dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Go to Today</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {dayPlan.assignedCount > 0
            ? `${dayPlan.assignedCount} student${dayPlan.assignedCount !== 1 ? "s" : ""} with workouts · ${formatDateLabel(sessionDate)}`
            : `Plan the day — assign students, paste SMS, view your schedule for ${formatDateLabel(sessionDate)}.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/today?date=${prevKey}`} className="btn-ghost px-2 py-1 text-xs">
            ← Prev
          </Link>
          <span className="font-medium">{formatDateLabel(sessionDate)}</span>
          <Link href={`/admin/today?date=${nextKey}`} className="btn-ghost px-2 py-1 text-xs">
            Next →
          </Link>
          {sessionDate !== todayKey && (
            <Link href="/admin/today" className="text-xs text-accent hover:underline ml-2">
              Back to today
            </Link>
          )}
        </div>
        <span className="text-xs text-[var(--muted)]">
          {dayPlan.timeline.length} on schedule · {dayPlan.openCount} students open
        </span>
      </div>

      <TodaySessionPanel
        asInstructor
        programSlug={session?.programSlug || "adult"}
        memberOptions={coachMembers}
        defaultUserIds={
          session?.userIds?.length ? session.userIds : [DEFAULT_DEMO_MEMBER_ID]
        }
        defaultDate={sessionDate}
        defaultTime={session ? new Date(session.scheduledAt).toTimeString().slice(0, 5) : "06:30"}
        collapsible
        defaultAssignOpen
        defaultOpen={false}
      />

      <CoachDayView day={dayPlan} dateQuery={sessionDate} />
    </div>
  );
}