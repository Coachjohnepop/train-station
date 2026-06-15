import {
  getSessionForUserOnDate,
  getTodaySessionForUser,
  getUpcomingSessionsForUser,
  hydrateTodaySessions,
  type TodaySession,
} from "@/lib/today-sessions";

export function memberTodayHref(session: TodaySession | null): string {
  if (!session) return "/member/today";
  return `/member/today?date=${session.sessionDate}`;
}

export async function resolveMemberSession(userId: string, dateParam?: string): Promise<TodaySession | null> {
  await hydrateTodaySessions();
  if (dateParam) {
    return getSessionForUserOnDate(userId, dateParam);
  }
  return getTodaySessionForUser(userId);
}

export async function loadMemberUpcomingSessions(userId: string): Promise<TodaySession[]> {
  await hydrateTodaySessions();
  return getUpcomingSessionsForUser(userId);
}