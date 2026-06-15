import {
  getTodaySessionByDate,
  getTodaySessionForUser,
  type TodaySession,
} from "@/lib/today-sessions";

export function memberTodayHref(session: TodaySession | null): string {
  if (!session) return "/member/today";
  return `/member/today?date=${session.sessionDate}`;
}

export function resolveMemberSession(userId: string, dateParam?: string): TodaySession | null {
  if (dateParam) {
    const s = getTodaySessionByDate(dateParam);
    if (!s) return null;
    if (s.userIds.length > 0 && !s.userIds.includes(userId)) return null;
    return s;
  }
  return getTodaySessionForUser(userId);
}