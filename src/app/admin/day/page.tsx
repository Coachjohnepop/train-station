import { redirect } from "next/navigation";
import CoachResumeRedirect from "@/components/CoachResumeRedirect";
import CoachDayHub from "@/components/CoachDayHub";
import CoachLiveZoomStrip from "@/components/CoachLiveZoomStrip";
import { buildCoachDayPlan } from "@/lib/coach-day";
import { hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { getSessionUser } from "@/lib/auth";
import { canAccessCoachAdmin } from "@/lib/staff-access";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default async function AdminDayPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session || !canAccessCoachAdmin(session.role)) {
    redirect("/login?redirect=/admin/day");
  }

  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const sp = await searchParams;
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = sp.date || todayKey;
  const dayPlan = await buildCoachDayPlan(sessionDate);

  const prevDate = new Date(`${sessionDate}T12:00:00`);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(`${sessionDate}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const prevKey = prevDate.toISOString().slice(0, 10);
  const nextKey = nextDate.toISOString().slice(0, 10);

  return (
    <div className="coach-dashboard space-y-4 pb-4">
      <CoachResumeRedirect />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <a href={`/admin/day?date=${prevKey}`} className="btn-ghost min-h-[44px] px-3 text-xs">
            ←
          </a>
          {sessionDate !== todayKey && (
            <a href="/admin/day" className="text-xs text-accent hover:underline">
              Today
            </a>
          )}
          <a href={`/admin/day?date=${nextKey}`} className="btn-ghost min-h-[44px] px-3 text-xs">
            →
          </a>
        </div>
      </div>

      {dayPlan.timeline.filter((item) => item.type === "live-booking").length > 0 ? (
        <CoachLiveZoomStrip
          items={dayPlan.timeline.filter((item) => item.type === "live-booking")}
        />
      ) : null}

      <CoachDayHub
        key={sessionDate}
        sessionDate={sessionDate}
        dateLabel={formatDateLabel(sessionDate)}
        calendarToday={todayKey}
        students={dayPlan.students}
        sessionCount={dayPlan.sessions.length}
        coachEmail={session.email}
      />
    </div>
  );
}