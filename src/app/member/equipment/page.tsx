import MemberEquipmentPageClient from "@/components/MemberEquipmentPageClient";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export const dynamic = "force-dynamic";

export default async function MemberEquipmentPage() {
  const videos = await getResolvedLandingVideos();

  return (
    <MemberEquipmentPageClient equipmentIntroVideoUrl={videos.equipmentIntroVideoUrl} />
  );
}
