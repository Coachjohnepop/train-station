import { listCoachRosterMembers } from "@/lib/coach-roster";
import { getSessionsForDate, listTodaySessions, type TodaySession } from "@/lib/today-sessions";
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
  durationMin?: number;
  zoomUrl?: string | null;
  zoomHostUrl?: string | null;
  exercisePreview: string[];
  coachHref: string;
  checkoffHrefs: { memberId: string; name: string; href: string }[];
};

export type CoachDayStudentCard = {
  id: string;
  name: string;
  assigned: boolean;
  workoutTitle?: string;
  workoutId?: string;
  sessionId?: string;
  timeLabel?: string;
  exercisePreview: string[];
  checkoffHref?: string;
};

export type CoachDayPlan = {
  sessionDate: string;
  sessions: TodaySession[];
  timeline: CoachDayTimelineItem[];
  students: CoachDayStudentCard[];
  assignedCount: number;
  openCount: number;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export async function buildCoachDayPlan(sessionDate: string): Promise<CoachDayPlan> {
  const sessions = getSessionsForDate(sessionDate);
  const appointments = await getAppointmentsForDate(sessionDate);
  const roster = await listCoachRosterMembers();

  const previewByWorkout = new Map<string, string[]>();
  for (const session of sessions) {
    if (!previewByWorkout.has(session.workoutId)) {
      previewByWorkout.set(session.workoutId, await getWorkoutExercisePreview(session.workoutId));
    }
  }

  const timeline: CoachDayTimelineItem[] = await Promise.all(
    appointments.map(async (appt: TodayAppointment) => {
      const preview =
        appt.type === "sms-workout" && appt.workoutId
          ? previewByWorkout.get(appt.workoutId) || (await getWorkoutExercisePreview(appt.workoutId))
          : [];

      return {
        id: appt.id,
        timeLabel: formatTime(appt.scheduledAt),
        scheduledAt: appt.scheduledAt,
        type: appt.type,
        title: appt.title,
        memberNames: appt.memberNames,
        memberIds: appt.memberIds,
        status: appt.status,
        durationMin: appt.durationMin,
        zoomUrl: appt.zoomUrl,
        zoomHostUrl: appt.zoomHostUrl,
        exercisePreview: preview,
        coachHref: appt.coachHref,
        checkoffHrefs: appt.memberIds.map((id, i) => ({
          memberId: id,
          name: appt.memberNames[i] || id,
          href: `/member/today?asInstructor=true&forUser=${id}&date=${sessionDate}`,
        })),
      };
    }),
  );

  timeline.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const sessionByUser = new Map<string, TodaySession>();
  for (const session of sessions) {
    for (const uid of session.userIds) {
      if (!sessionByUser.has(uid)) sessionByUser.set(uid, session);
    }
  }

  const students: CoachDayStudentCard[] = roster.map((m) => {
    const session = sessionByUser.get(m.id);
    const assigned = !!session;
    const preview = session ? previewByWorkout.get(session.workoutId) || [] : [];
    return {
      id: m.id,
      name: m.name,
      assigned,
      workoutTitle: session?.title,
      workoutId: session?.workoutId,
      sessionId: session?.id,
      timeLabel: session ? formatTime(session.scheduledAt) : undefined,
      exercisePreview: preview,
      checkoffHref: assigned
        ? `/member/today?asInstructor=true&forUser=${m.id}&date=${sessionDate}`
        : undefined,
    };
  });

  return {
    sessionDate,
    sessions,
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