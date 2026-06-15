import {
  getTodaySessionByDate,
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
    const s = getTodaySessionByDate(dateParam);
    if (!s) return null;
    if (!s.userIds.includes(userId)) return null;
    return s;
  }
  return getTodaySessionForUser(userId);
}

export async function loadMemberUpcomingSessions(userId: string): Promise<TodaySession[]> {
  await hydrateTodaySessions();
  return getUpcomingSessionsForUser(userId);
}