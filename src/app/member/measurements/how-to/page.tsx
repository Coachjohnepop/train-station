import MeasurementsHowToClient from "@/components/MeasurementsHowToClient";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export const dynamic = "force-dynamic";

export default async function MeasurementsHowToPage() {
  const videos = await getResolvedLandingVideos();
  return <MeasurementsHowToClient videoUrl={videos.measurementsIntroVideoUrl} />;
}
