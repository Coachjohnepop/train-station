import CoachResumeRedirect from "@/components/CoachResumeRedirect";
import CoachDashboard from "@/components/CoachDashboard";
import { buildCoachDayPlan } from "@/lib/coach-day";
import { hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { listCoachMembersForUi } from "@/lib/sms";
import { getSessionUser } from "@/lib/auth";
import { canAccessCoachAdmin } from "@/lib/staff-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ plan?: string }>;
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

  const sp = await searchParams;
  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayPlan = await buildCoachDayPlan(todayKey);
  const coachMembers = (await listCoachMembersForUi()).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="coach-dashboard pb-4">
      <CoachResumeRedirect />
      <CoachDashboard
        key={todayKey}
        sessionDate={todayKey}
        dateLabel={formatDateLabel(todayKey)}
        students={dayPlan.students}
        sessionCount={dayPlan.sessions.length}
        savedSessions={dayPlan.sessions}
        memberOptions={coachMembers}
        initialPlanOpen={sp.plan === "1"}
      />
    </div>
  );
}