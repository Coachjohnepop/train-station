import "server-only";

import { getLandingMedia } from "@/lib/landing-media-store";
import {
  equipmentIntroVideoUrlFromConfig,
  freeChastiseVideoUrlFromConfig,
  resolveFreeTicketGag,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";

export async function getResolvedLandingVideos() {
  const config = await getLandingMedia();
  const welcomeVideosByPlan = Object.fromEntries(
    Object.entries(config.welcomeVideosByPlan).map(([plan, url]) => [
      plan,
      url ? welcomeVideoUrlFromConfig(url) : null,
    ]),
  ) as Record<string, string | null>;
  const gag = resolveFreeTicketGag(config);
  return {
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    welcomeVideosByPlan,
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    purchaseThankYouVideoUrl: config.purchaseThankYouVideoUrl?.trim() || null,
    equipmentIntroVideoUrl: equipmentIntroVideoUrlFromConfig(config.equipmentIntroVideoUrl),
    gag: {
      enabled: gag.enabled,
      videoUrl: gag.videoUrl,
      startSec: gag.startSec,
      durationSec: Math.round(gag.durationMs / 1000),
    },
    updatedAt: config.updatedAt,
  };
}