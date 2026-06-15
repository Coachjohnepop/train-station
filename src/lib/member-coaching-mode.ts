export type MemberCoachingMode = "live" | "async";

/** How each member is coached — drives Messages inbox grouping. */
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

export function getMemberCoachingMode(memberId: string): MemberCoachingMode {
  return MEMBER_COACHING_MODE[memberId] ?? "async";
}