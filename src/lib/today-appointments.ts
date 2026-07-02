import { getBookings } from "@/lib/booking";
import { getSessionsForDate } from "@/lib/today-sessions";
import { resolveDemoUser, resolveDemoUserByEmail } from "@/lib/demo-user-directory";

export type TodayAppointment = {
  id: string;
  type: "sms-workout" | "live-booking";
  scheduledAt: string;
  title: string;
  memberNames: string[];
  memberIds: string[];
  memberEmails: string[];
  status?: string;
  durationMin?: number;
  workoutId?: string;
  zoomUrl?: string | null;
  zoomHostUrl?: string | null;
  coachHref: string;
  memberHref: string;
};

function dateKey(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function resolveMembersFromIds(userIds: string[]) {
  return userIds.map((id) => {
    const u = resolveDemoUser(id);
    return { id, name: u?.name || id, email: u?.email || "" };
  });
}

export async function getAppointmentsForDate(sessionDate: string): Promise<TodayAppointment[]> {
  const appointments: TodayAppointment[] = [];

  for (const session of getSessionsForDate(sessionDate)) {
    const members = resolveMembersFromIds(session.userIds);
    appointments.push({
      id: session.id,
      type: "sms-workout",
      scheduledAt: session.scheduledAt,
      title: session.title,
      memberNames: members.map((m) => m.name),
      memberIds: members.map((m) => m.id),
      memberEmails: members.map((m) => m.email),
      status: session.replacesSchedule ? "overrides schedule" : "scheduled",
      workoutId: session.workoutId,
      coachHref: `/member/today?asInstructor=true&date=${sessionDate}`,
      memberHref: `/member/today`,
    });
  }

  const bookings = await getBookings();
  for (const b of bookings) {
    if (dateKey(b.scheduledAt) !== sessionDate) continue;
    const u = b.user || resolveDemoUserByEmail(b.memberEmail);
    appointments.push({
      id: b.id,
      type: "live-booking",
      scheduledAt: b.scheduledAt,
      title: b.notes || "Live session / onboarding call",
      memberNames: [u?.name || b.memberEmail.split("@")[0]],
      memberIds: [b.userId || u?.id || ""].filter(Boolean),
      memberEmails: [b.memberEmail],
      status: b.status,
      durationMin: b.durationMin,
      zoomUrl: b.zoomUrl || null,
      zoomHostUrl: b.zoomHostUrl || null,
      coachHref: `/member/live?asInstructor=true&forUser=${encodeURIComponent(b.memberEmail)}`,
      memberHref: `/member/live`,
    });
  }

  return appointments.sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

export async function getCoachTodaySummary(referenceDate = new Date()) {
  const sessionDate = referenceDate.toISOString().slice(0, 10);
  const appointments = await getAppointmentsForDate(sessionDate);
  return { sessionDate, appointments, count: appointments.length };
}