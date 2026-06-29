import "server-only";

import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export async function countCoachQueueItems(): Promise<number> {
  const [accounts, profiles] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  let count = 0;

  for (const { account } of accounts) {
    const profile = profileByUserId.get(account.userId);
    if (!profile) continue;

    if (profile.approvalStatus === "pending" && profile.onboardingComplete) {
      count += 1;
      continue;
    }
    if (isPaidPlan(profile.plan) && profile.paymentStatus !== "paid") {
      count += 1;
      continue;
    }
    if (profile.onboardingComplete && !profile.coachIntakeCompleteAt) {
      count += 1;
      continue;
    }
    if (profile.coachMeetingRequestedAt) {
      count += 1;
    }
  }

  return count;
}