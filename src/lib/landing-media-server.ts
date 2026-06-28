import "server-only";

import { getLandingMedia } from "@/lib/landing-media-store";
import {
  freeChastiseVideoUrlFromConfig,
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
  return {
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    welcomeVideosByPlan,
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    updatedAt: config.updatedAt,
  };
}