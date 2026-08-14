import type { MemberProfile } from "@/lib/member-profiles-store";

export function isCoachIntakeComplete(
  profile: Pick<MemberProfile, "coachIntakeCompleteAt"> | null | undefined,
): boolean {
  return Boolean(profile?.coachIntakeCompleteAt);
}

export function memberNeedsIntake(profile: MemberProfile | null): boolean {
  if (!profile?.onboardingComplete) return false;
  return !isCoachIntakeComplete(profile);
}

export const MEMBER_FIRST_MEASUREMENTS_PATH = "/member/measurements?first=1";