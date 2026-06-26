import "server-only";

import { getOfferDefinition } from "@/lib/product-offers";
import type { SignupPlan } from "@/lib/signup-plans";
import { updateMemberProfile, type MemberProfile } from "@/lib/member-profiles-store";

export async function applyOfferBenefitsAfterPayment(
  userId: string,
  plan: SignupPlan,
  profile: MemberProfile,
): Promise<MemberProfile> {
  const offer = getOfferDefinition(plan);
  if (!offer?.intensivePackage) return profile;

  const now = new Date();
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + offer.intensivePackage.windowDays);

  return updateMemberProfile(userId, {
    plan,
    intensiveSessionsTotal: offer.intensivePackage.sessionsTotal,
    intensiveSessionsRemaining: offer.intensivePackage.sessionsTotal,
    intensiveWindowDays: offer.intensivePackage.windowDays,
    intensiveStartsAt: now.toISOString(),
    intensiveExpiresAt: expires.toISOString(),
  });
}