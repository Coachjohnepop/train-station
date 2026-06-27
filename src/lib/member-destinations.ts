import type { MemberProfile } from "@/lib/member-profiles-store";
import { MEMBER_PENDING_PATH, memberNeedsApproval } from "@/lib/member-gates";

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
  programSlug: string,
): string {
  if (memberNeedsApproval(profile, userId)) return MEMBER_PENDING_PATH;
  return memberProgramStartPath(programSlug);
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