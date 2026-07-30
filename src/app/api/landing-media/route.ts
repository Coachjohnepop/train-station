import { NextResponse } from "next/server";
import { getLandingMedia } from "@/lib/landing-media-store";

export const dynamic = "force-dynamic";
import {
  equipmentIntroVideoUrlFromConfig,
  freeChastiseVideoUrlFromConfig,
  resolveFreeTicketGag,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";

export async function GET() {
  const config = await getLandingMedia();
  const gag = resolveFreeTicketGag(config);
  return NextResponse.json({
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    purchaseThankYouVideoUrl: config.purchaseThankYouVideoUrl?.trim() || null,
    equipmentIntroVideoUrl: equipmentIntroVideoUrlFromConfig(config.equipmentIntroVideoUrl),
    uploadedContentVolumeDb: config.uploadedContentVolumeDb,
    gag: {
      enabled: gag.enabled,
      videoUrl: gag.videoUrl,
      startSec: gag.startSec,
      durationSec: Math.round(gag.durationMs / 1000),
    },
    updatedAt: config.updatedAt,
    hasWelcome: Boolean(welcomeVideoUrlFromConfig(config.welcomeVideoUrl)),
    hasFreeChastise: Boolean(freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl)),
    hasPurchaseThankYou: Boolean(config.purchaseThankYouVideoUrl?.trim()),
    hasEquipmentIntro: Boolean(
      equipmentIntroVideoUrlFromConfig(config.equipmentIntroVideoUrl),
    ),
  });
}