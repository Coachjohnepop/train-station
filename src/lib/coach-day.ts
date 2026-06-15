import { listMembersForCoach } from "@/lib/demo-coach";
import { getTodaySessionByDate, listTodaySessions, type TodaySession } from "@/lib/today-sessions";
import { getAppointmentsForDate, type TodayAppointment } from "@/lib/today-appointments";
import { getWorkoutExercisePreview } from "@/lib/sms-generated-workouts";

export type CoachDayTimelineItem = {
  id: string;
  timeLabel: string;
  scheduledAt: string;
  type: "sms-workout" | "live-booking";
  title: string;
  memberNames: string[];
  memberIds: string[];
  status?: string;
  exercisePreview: string[];
  coachHref: string;
  checkoffHrefs: { memberId: string; name: string; href: string }[];
};

export type CoachDayStudentCard = {
  id: string;
  name: string;
  assigned: boolean;
  workoutTitle?: string;
  timeLabel?: string;
  exercisePreview: string[];
  checkoffHref?: string;
};

export type CoachDayPlan = {
  sessionDate: string;
  session: TodaySession | null;
  timeline: CoachDayTimelineItem[];
  students: CoachDayStudentCard[];
  assignedCount: number;
  openCount: number;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export async function buildCoachDayPlan(sessionDate: string): Promise<CoachDayPlan> {
  const session = getTodaySessionByDate(sessionDate);
  const appointments = await getAppointmentsForDate(sessionDate);
  const roster = listMembersForCoach();

  const preview = session?.workoutId ? await getWorkoutExercisePreview(session.workoutId) : [];

  const timeline: CoachDayTimelineItem[] = appointments.map((appt: TodayAppointment) => ({
    id: appt.id,
    timeLabel: formatTime(appt.scheduledAt),
    scheduledAt: appt.scheduledAt,
    type: appt.type,
    title: appt.title,
    memberNames: appt.memberNames,
    memberIds: appt.memberIds,
    status: appt.status,
    exercisePreview: appt.type === "sms-workout" ? preview : [],
    coachHref: appt.coachHref,
    checkoffHrefs: appt.memberIds.map((id, i) => ({
      memberId: id,
      name: appt.memberNames[i] || id,
      href: `/member/today?asInstructor=true&forUser=${id}&date=${sessionDate}`,
    })),
  }));

  const assignedIds = new Set(session?.userIds ?? []);

  const students: CoachDayStudentCard[] = roster.map((m) => {
    const assigned = assignedIds.has(m.id);
    return {
      id: m.id,
      name: m.name,
      assigned,
      workoutTitle: assigned ? session?.title : undefined,
      timeLabel: assigned && session ? formatTime(session.scheduledAt) : undefined,
      exercisePreview: assigned ? preview : [],
      checkoffHref: assigned
        ? `/member/today?asInstructor=true&forUser=${m.id}&date=${sessionDate}`
        : undefined,
    };
  });

  return {
    sessionDate,
    session,
    timeline,
    students,
    assignedCount: students.filter((s) => s.assigned).length,
    openCount: students.filter((s) => !s.assigned).length,
  };
}

export function listCoachWeekSessionDates(anchorDate: string, days = 7): string[] {
  const base = new Date(`${anchorDate}T12:00:00`);
  const keys: string[] = [];
  for (let i = -2; i < days - 2; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function getSessionsInRange(dates: string[]) {
  const dateSet = new Set(dates);
  return listTodaySessions().filter((s) => dateSet.has(s.sessionDate));
}