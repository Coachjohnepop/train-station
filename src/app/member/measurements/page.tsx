import MemberMeasurementsClient from "@/components/MemberMeasurementsClient";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { resolveMemberUserId } from "@/lib/current-user";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";

export const dynamic = "force-dynamic";

export default async function MemberMeasurementsPage() {
  const [videos, uid] = await Promise.all([
    getResolvedLandingVideos(),
    resolveMemberUserId(),
  ]);
  const profile = await getMemberProfile(uid);
  const plan = await getEffectiveMembershipPlan(uid, profile?.plan);
  const freeExplorer = isFreeExplorerPlan(plan);

  return (
    <div className="space-y-4">
      {freeExplorer ? (
        <FreeUpgradeTease
          title="Measure on Free · full history on Coach Class"
          body="Log your check-in sheet now. Multi-check-in trends, photo history, and coach review depth unlock with a paid ticket."
        />
      ) : null}
      <MemberMeasurementsClient
        introVideoUrl={videos.measurementsIntroVideoUrl}
        freeExplorer={freeExplorer}
      />
    </div>
  );
}
