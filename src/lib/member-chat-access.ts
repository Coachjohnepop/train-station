/**
 * Which Messages group (cohort) tabs a member may see / open.
 *
 * Policy (product):
 * - Free Explorer → Coach 1:1 only (no group beans, even if enrolled for content).
 * - Coach Class+ → Coach 1:1 + program groups they are enrolled in only.
 * - Never force Station / Adult “always-on” community tabs.
 */

import { getUserEnrollments } from "@/lib/data/user-data";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { getMemberProfile } from "@/lib/member-profiles-store";

/** Program slugs whose cohort threads may appear for this member. */
export async function resolveMemberVisibleCohortSlugs(memberId: string): Promise<string[]> {
  if (!memberId) return [];

  try {
    const profile = await getMemberProfile(memberId);
    const plan = await getEffectiveMembershipPlan(memberId, profile?.plan);
    if (isFreeExplorerPlan(plan)) return [];
  } catch {
    // Fail closed on plan lookup errors — better to hide groups than leak them.
    return [];
  }

  try {
    return Object.keys(await getUserEnrollments(memberId));
  } catch {
    return [];
  }
}
