import LandingConversion from "@/components/LandingConversion";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import type { LandingAbVariant } from "@/lib/landing-ab";

/** Guest A/B landings at /a and /b — works signed-in or not. */
export default async function ForcedLandingPage({
  variant,
}: {
  variant: LandingAbVariant;
}) {
  const landingVideos = await getResolvedLandingVideos();
  return (
    <LandingConversion
      welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
      heroSlides={landingVideos.heroSlides}
      returning={false}
      rememberReturn={false}
      variant={variant}
      meetVideoUrl={landingVideos.welcomeVideoUrl}
    />
  );
}
