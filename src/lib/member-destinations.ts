import type { MemberProfile } from "@/lib/member-profiles-store";
import {
  MEMBER_PENDING_PATH,
  memberCheckoutPath,
  memberNeedsApproval,
  memberNeedsPayment,
  memberNeedsPaymentAsync,
} from "@/lib/member-gates";

/** Member dashboard entry — routes to the Today hub. */
export function memberDashboardPath(): string {
  return "/member";
}

/** Primary member hub after signup — today's workout, coach comms, enrolled program. */
export function memberTodayPath(): string {
  return "/member/today";
}

/** Where to send a member after enroll or onboarding for a given program. */
export function memberProgramStartPath(_programSlug?: string): string {
  return memberTodayPath();
}

export function memberPostOnboardPath(
  profile: MemberProfile | null,
  userId: string,
  _programSlug: string,
): string {
  // Unpaid paid-plan members finish setup → checkout (not free Today access).
  // Sync path ignores free-week; prefer memberPostOnboardPathAsync on server.
  if (memberNeedsPayment(profile, userId)) {
    return memberCheckoutPath(profile?.plan);
  }
  if (memberNeedsApproval(profile, userId)) return MEMBER_PENDING_PATH;
  return memberDashboardPath();
}

/** Post-onboard redirect that honors claimed free-week promos. */
export async function memberPostOnboardPathAsync(
  profile: MemberProfile | null,
  userId: string,
  _programSlug: string,
): Promise<string> {
  if (await memberNeedsPaymentAsync(profile, userId)) {
    return memberCheckoutPath(profile?.plan);
  }
  if (memberNeedsApproval(profile, userId)) return MEMBER_PENDING_PATH;
  return memberDashboardPath();
}

export function memberOnboardPath(programSlug?: string): string {
  if (!programSlug) return "/member/onboard";
  return `/member/onboard?program=${encodeURIComponent(programSlug)}`;
}

export async function resolvePostEnrollRedirect(
  userId: string,
  programSlug: string,
): Promise<string> {
  const { getMemberProfile } = await import("@/lib/member-profiles-store");
  const profile = await getMemberProfile(userId);
  if (!profile?.onboardingComplete) {
    return memberOnboardPath(programSlug);
  }
  void programSlug;
  void userId;
  return memberTodayPath();
}