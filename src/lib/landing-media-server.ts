import "server-only";

import { getLandingMedia } from "@/lib/landing-media-store";
import {
  equipmentIntroVideoUrlFromConfig,
  freeChastiseVideoUrlFromConfig,
  measurementsIntroVideoUrlFromConfig,
  resolveFreeTicketGag,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";
import { activeHeroSlides } from "@/lib/hero-slides";

export async function getResolvedLandingVideos() {
  const config = await getLandingMedia();
  // One Free Explorer URL: free-ticket field wins, else legacy byPlan.explorer
  const freeExplorer =
    freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl) ||
    freeChastiseVideoUrlFromConfig(config.welcomeVideosByPlan?.explorer) ||
    null;

  const welcomeVideosByPlan = Object.fromEntries(
    Object.entries(config.welcomeVideosByPlan).map(([plan, url]) => [
      plan,
      url ? welcomeVideoUrlFromConfig(url) : null,
    ]),
  ) as Record<string, string | null>;
  // Always expose unified Free Explorer on explorer plan for onboard
  if (freeExplorer) {
    welcomeVideosByPlan.explorer = freeExplorer;
  }

  const gag = resolveFreeTicketGag(config);
  return {
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    welcomeVideosByPlan,
    freeChastiseVideoUrl: freeExplorer,
    purchaseThankYouVideoUrl: config.purchaseThankYouVideoUrl?.trim() || null,
    equipmentIntroVideoUrl: equipmentIntroVideoUrlFromConfig(config.equipmentIntroVideoUrl),
    measurementsIntroVideoUrl: measurementsIntroVideoUrlFromConfig(
      config.measurementsIntroVideoUrl,
    ),
    heroSlides: activeHeroSlides(config.heroSlides),
    uploadedContentVolumeDb: config.uploadedContentVolumeDb,
    gag: {
      enabled: gag.enabled,
      videoUrl: gag.videoUrl,
      startSec: gag.startSec,
      durationSec: Math.round(gag.durationMs / 1000),
    },
    updatedAt: config.updatedAt,
  };
}