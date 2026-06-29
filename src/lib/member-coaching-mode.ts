export type MemberCoachingMode = "live" | "async";

/** Legacy demo defaults — used when no stored pref exists. */
export const MEMBER_COACHING_MODE: Record<string, MemberCoachingMode> = {
  "demo-user-stephanie": "live",
  "demo-user-john": "async",
  "demo-user-john-steph": "live",
  "demo-user": "async",
  "demo-user-2": "async",
};

export const COACHING_MODE_LABELS: Record<MemberCoachingMode, string> = {
  live: "Live",
  async: "Asynch",
};

export function defaultCoachingModeForMember(memberId: string): MemberCoachingMode {
  return MEMBER_COACHING_MODE[memberId] ?? "async";
}

export function coachingModeFromPrefs(
  prefs: { coachingMode?: MemberCoachingMode } | null | undefined,
  memberId: string,
): MemberCoachingMode {
  if (prefs?.coachingMode) return prefs.coachingMode;
  return defaultCoachingModeForMember(memberId);
}

/** @deprecated Prefer resolveMemberCoachingMode on the server. */
export function getMemberCoachingMode(memberId: string): MemberCoachingMode {
  return defaultCoachingModeForMember(memberId);
}

