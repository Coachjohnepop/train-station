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

/** Joined any seat, has not booked the 15-min intro, and has not already sat with Jeremy. */
export function memberNeedsIntroBooking(
  profile:
    | Pick<MemberProfile, "onboardingComplete" | "introBookedAt" | "coachIntakeCompleteAt">
    | null
    | undefined,
): boolean {
  if (!profile?.onboardingComplete) return false;
  if (isCoachIntakeComplete(profile)) return false;
  return !profile.introBookedAt;
}

export const MEMBER_FIRST_MEASUREMENTS_PATH = "/member/measurements?first=1";