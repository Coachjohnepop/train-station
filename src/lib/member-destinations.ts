/** Where to send a member after enroll or onboarding for a given program. */
export function memberProgramStartPath(programSlug: string): string {
  return `/member/workout?program=${encodeURIComponent(programSlug)}`;
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
  return memberProgramStartPath(programSlug);
}