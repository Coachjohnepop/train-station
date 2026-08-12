import "server-only";

import {
  memberOnboardEntryPath,
  memberTodayEntryPath,
} from "@/lib/member-app-entry";
import type { MemberProfile } from "@/lib/member-profiles-store";
import {
  MEMBER_PENDING_PATH,
  memberCheckoutPath,
  memberNeedsApproval,
  memberNeedsFreePaymentMethodAsync,
  memberNeedsPaymentAsync,
} from "@/lib/member-gates";
import { memberFreePaymentSetupPath } from "@/lib/member-route-gates";

/** Server: DB-backed entry after gates are evaluated. */
export async function resolveMemberAppEntryPath(
  userId: string,
  profile: MemberProfile | null,
): Promise<string> {
  if (await memberNeedsPaymentAsync(profile, userId)) {
    return memberCheckoutPath(profile?.plan);
  }
  if (await memberNeedsFreePaymentMethodAsync(profile, userId)) {
    return memberFreePaymentSetupPath();
  }
  if (memberNeedsApproval(profile, userId)) {
    return MEMBER_PENDING_PATH;
  }
  if (!profile?.onboardingComplete) {
    return memberOnboardEntryPath(profile?.plan);
  }
  return memberTodayEntryPath();
}
