import MeasurementsHub from "@/components/MeasurementsHub";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { resolveMemberUserId } from "@/lib/current-user";
import { countUserMeasurements } from "@/lib/measurements-store";

export const dynamic = "force-dynamic";

export default async function MemberMeasurementsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const sp = await searchParams;
  const [videos, uid] = await Promise.all([
    getResolvedLandingVideos(),
    resolveMemberUserId(),
  ]);
  const checkInCount = uid ? await countUserMeasurements(uid) : 0;

  return (
    <MeasurementsHub
      firstOnboard={sp.first === "1"}
      hasVideo={Boolean(videos.measurementsIntroVideoUrl?.trim())}
      checkInCount={checkInCount}
    />
  );
}
