import Link from "next/link";
import MemberMeasurementsClient from "@/components/MemberMeasurementsClient";
import FreeUpgradeTease from "@/components/FreeUpgradeTease";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { resolveMemberUserId } from "@/lib/current-user";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { getEffectiveMembershipPlan } from "@/lib/gamification-promos";
import { isFreeExplorerPlan } from "@/lib/free-tier-product";

export const dynamic = "force-dynamic";

export default async function MemberMeasurementsEnterPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const sp = await searchParams;
  const firstOnboard = sp.first === "1";
  const [videos, uid] = await Promise.all([
    getResolvedLandingVideos(),
    resolveMemberUserId(),
  ]);
  const profile = await getMemberProfile(uid);
  const plan = await getEffectiveMembershipPlan(uid, profile?.plan);
  const freeExplorer = isFreeExplorerPlan(plan);

  return (
    <div className="space-y-4">
      <Link href="/member/measurements" className="text-xs font-semibold text-accent hover:underline">
        ← Measurements
      </Link>
      {firstOnboard ? (
        <div className="card border-accent/40 bg-accent/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            After your intro
          </p>
          <h1 className="mt-1 text-xl font-bold">Enter measurements</h1>
          <p className="mt-1 text-sm text-[color-mix(in_srgb,var(--text)_82%,var(--muted))]">
            Starting weight and goal first — then today&apos;s check-in, tape, and photos. Watch the
            how-to on this page anytime.
          </p>
        </div>
      ) : null}
      {freeExplorer ? (
        <FreeUpgradeTease
          title="Measure on Free · full history on Coach Class"
          body="Log your check-in sheet now. Multi-check-in trends, photo history, and coach review depth unlock with a paid ticket."
        />
      ) : null}
      <MemberMeasurementsClient
        introVideoUrl={videos.measurementsIntroVideoUrl}
        freeExplorer={freeExplorer}
        firstOnboard={firstOnboard}
        autoOpenIntro={false}
      />
    </div>
  );
}
