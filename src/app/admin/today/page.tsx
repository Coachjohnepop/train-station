import CoachDayHub from "@/components/CoachDayHub";
import { buildCoachDayPlan } from "@/lib/coach-day";
import { hydrateTodaySessions } from "@/lib/today-sessions";
import { hydrateSmsWorkouts } from "@/lib/sms-generated-workouts";
import { getSessionUser } from "@/lib/auth";
import { canAccessCoachAdmin } from "@/lib/staff-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDateLabel(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/** Full-screen gym floor — today only, no day picker. */
export default async function AdminTodayPage() {
  const session = await getSessionUser();
  if (!session || !canAccessCoachAdmin(session.role)) {
    redirect("/login?redirect=/admin/today");
  }

  await Promise.all([hydrateTodaySessions(), hydrateSmsWorkouts()]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const dayPlan = await buildCoachDayPlan(todayKey);

  return (
    <CoachDayHub
      key={todayKey}
      variant="floor"
      sessionDate={todayKey}
      dateLabel={formatDateLabel(todayKey)}
      students={dayPlan.students}
      coachEmail={session.email}
    />
  );
}