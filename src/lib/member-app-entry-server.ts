import "server-only";

import type { MemberProfile } from "@/lib/member-profiles-store";
import {
  memberNeedsApproval,
  memberNeedsFreePaymentMethodAsync,
  memberNeedsPaymentAsync,
} from "@/lib/member-gates";
import { memberNeedsFirstTapeMeasurements } from "@/lib/member-measurement-schedule";
import { listUserMeasurements } from "@/lib/measurements-store";
import { nextNewbieHref } from "@/lib/newbie-step";

/** Server: DB-backed entry after gates are evaluated. Always a concrete screen. */
export async function resolveMemberAppEntryPath(
  userId: string,
  profile: MemberProfile | null,
): Promise<string> {
  const needsPayment = await memberNeedsPaymentAsync(profile, userId);
  const needsFreePm = await memberNeedsFreePaymentMethodAsync(profile, userId);
  const needsApproval = memberNeedsApproval(profile, userId);
  let needsFirstTape = false;
  if (profile?.onboardingComplete && profile.coachIntakeCompleteAt) {
    const checkIns = await listUserMeasurements(userId, 1);
    needsFirstTape = memberNeedsFirstTapeMeasurements({
      onboardingComplete: true,
      coachIntakeCompleteAt: profile.coachIntakeCompleteAt,
      hasCheckIn: checkIns.length > 0,
    });
  }
  return nextNewbieHref({
    plan: profile?.plan,
    onboardingComplete: Boolean(profile?.onboardingComplete),
    paymentStatus: profile?.paymentStatus ?? null,
    needsPayment,
    needsFreePm,
    needsApproval,
    needsFirstTape,
  });
}
