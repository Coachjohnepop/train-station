import MemberMeasurementsClient from "@/components/MemberMeasurementsClient";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export const dynamic = "force-dynamic";

export default async function MemberMeasurementsPage() {
  const videos = await getResolvedLandingVideos();
  return (
    <MemberMeasurementsClient introVideoUrl={videos.measurementsIntroVideoUrl} />
  );
}
