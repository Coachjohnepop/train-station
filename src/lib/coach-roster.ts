import "server-only";

import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { resolveDemoUser } from "@/lib/demo-user-directory";

export type CoachRosterMember = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
};

/** Real ticket signups for coach Today, Live Floor, SMS, and chat roster. */
export async function listCoachRosterMembers(): Promise<CoachRosterMember[]> {
  const [accounts, profiles] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  const members: CoachRosterMember[] = [];

  for (const { email, account } of accounts) {
    if (account.hidden || account.role !== "MEMBER") continue;
    const profile = profileByUserId.get(account.userId);
    members.push({
      id: account.userId,
      email,
      name: account.name?.trim() || profile?.email?.split("@")[0] || email,
      phone: profile?.phone ?? account.phone ?? null,
    });
  }

  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}

export async function resolveCoachMemberName(
  userId: string,
  fallback = "Member",
): Promise<string> {
  const demo = resolveDemoUser(userId);
  if (demo?.name) return demo.name;

  const roster = await listCoachRosterMembers();
  const match = roster.find((m) => m.id === userId);
  if (match) return match.name;

  const profiles = await listMemberProfiles();
  const profile = profiles.find((p) => p.userId === userId);
  if (profile?.email) {
    const local = profile.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return fallback;
}