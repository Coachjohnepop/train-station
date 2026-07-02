import CoachResumeRedirect from "@/components/CoachResumeRedirect";
import CoachDashboard from "@/components/CoachDashboard";
import { buildCoachDayPlan, buildCoachDaySummaries } from "@/lib/coach-day";
import { hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { listCoachMembersForUi } from "@/lib/sms";
import { getSessionUser } from "@/lib/auth";
import { canAccessCoachAdmin } from "@/lib/staff-access";
import { addDaysIso } from "@/lib/workout-day-visibility";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ plan?: string; date?: string }>;
};

function parseSessionDate(raw: string | undefined, todayKey: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayKey;
}

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default async function AdminDayPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session || !canAccessCoachAdmin(session.role)) {
    redirect("/login?redirect=/admin/day");
  }

  const sp = await searchParams;
  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionDate = parseSessionDate(sp.date, todayKey);
  const dayPlan = await buildCoachDayPlan(sessionDate);
  const coachMembers = (await listCoachMembersForUi()).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  const bandDates = [
    addDaysIso(sessionDate, -1),
    todayKey,
    addDaysIso(todayKey, 1),
    addDaysIso(todayKey, 2),
    addDaysIso(sessionDate, 1),
  ];
  const daySummaries = buildCoachDaySummaries([...new Set(bandDates)]);

  return (
    <div className="coach-dashboard pb-4">
      <CoachResumeRedirect />
      <CoachDashboard
        key={sessionDate}
        sessionDate={sessionDate}
        calendarToday={todayKey}
        dateLabel={formatDateLabel(sessionDate)}
        students={dayPlan.students}
        sessionCount={dayPlan.sessions.length}
        savedSessions={dayPlan.sessions}
        memberOptions={coachMembers}
        daySummaries={daySummaries}
        initialPlanOpen={sp.plan === "1"}
      />
    </div>
  );
}