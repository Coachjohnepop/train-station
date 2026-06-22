import { DEMO_USER_DIRECTORY, type DemoUserEntry, resolveDemoUser } from "@/lib/demo-user-directory";

/** Primary demo member — couple account used for default member preview */
export const DEFAULT_DEMO_MEMBER_ID = "demo-user-john-steph";

export const DEMO_COACH = {
  id: "demo-coach-jeremy",
  email: "jeremy@thetrainstation.co",
  name: "Coach Jeremy",
  displayName: "Coach Jeremy",
  phone: "(555) 123-0001",
} as const;

/** Members assigned to Coach Jeremy (SMS / Go to Today / coach chat) */
export const JEREMY_MEMBER_IDS = [
  DEFAULT_DEMO_MEMBER_ID,
  "demo-user-john",
  "demo-user-stephanie",
  "demo-user",
  "demo-user-2",
] as const;

export function listMembersForCoach(_coachId?: string): DemoUserEntry[] {
  return JEREMY_MEMBER_IDS.map((id) => resolveDemoUser(id)).filter((u): u is DemoUserEntry => !!u);
}

export function coachDisplayName(session?: { name?: string | null } | null): string {
  const name = session?.name?.trim();
  if (name) return name.startsWith("Coach") ? name : `Coach ${name.split(" ")[0]}`;
  return DEMO_COACH.displayName;
}

export function isMemberOfCoachJeremy(userId: string): boolean {
  return (JEREMY_MEMBER_IDS as readonly string[]).includes(userId);
}