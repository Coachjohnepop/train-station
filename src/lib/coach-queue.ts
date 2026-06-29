import "server-only";

import { listSelfRegisteredAccounts } from "@/lib/member-accounts-store";
import { listMemberProfiles } from "@/lib/member-profiles-store";
import { signupPlanLabel } from "@/lib/signup-plans";

export type QueueAction = "approve" | "mark_paid" | "intake" | "meeting" | "message";

export type CoachQueueItem = {
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  plan: string;
  planLabel: string;
  reason: string;
  action: QueueAction;
  meetingNote: string | null;
};

function isPaidPlan(plan: string): boolean {
  return plan === "member" || plan === "pro" || plan === "business";
}

export async function listCoachQueueItems(): Promise<CoachQueueItem[]> {
  const [accounts, profiles] = await Promise.all([
    listSelfRegisteredAccounts(),
    listMemberProfiles(),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  const queue: CoachQueueItem[] = [];

  for (const { email, account } of accounts) {
    const profile = profileByUserId.get(account.userId);
    if (!profile) continue;

    const base = {
      userId: account.userId,
      email,
      name: account.name,
      phone: profile.phone ?? account.phone ?? null,
      plan: profile.plan,
      planLabel: signupPlanLabel(profile.plan),
      meetingNote: profile.coachMeetingRequestNote ?? null,
    };

    if (profile.approvalStatus === "pending" && profile.onboardingComplete) {
      queue.push({ ...base, reason: "Pending approval", action: "approve" });
      continue;
    }

    if (isPaidPlan(profile.plan) && profile.paymentStatus !== "paid") {
      queue.push({
        ...base,
        reason: `Awaiting payment · ${signupPlanLabel(profile.plan)}`,
        action: "mark_paid",
      });
      continue;
    }

    if (profile.onboardingComplete && !profile.coachIntakeCompleteAt) {
      queue.push({ ...base, reason: "Needs intake sign-off", action: "intake" });
      continue;
    }

    if (profile.coachMeetingRequestedAt) {
      queue.push({
        ...base,
        reason: profile.coachMeetingRequestNote
          ? `Meeting · ${profile.coachMeetingRequestNote}`
          : "Meeting requested",
        action: "meeting",
      });
    }
  }

  return queue;
}

export async function countCoachQueueItems(): Promise<number> {
  const items = await listCoachQueueItems();
  return items.length;
}