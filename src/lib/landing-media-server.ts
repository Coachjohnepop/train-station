import "server-only";

import { getLandingMedia } from "@/lib/landing-media-store";
import {
  freeChastiseVideoUrlFromConfig,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";

export async function getResolvedLandingVideos() {
  const config = await getLandingMedia();
  return {
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    updatedAt: config.updatedAt,
  };
}