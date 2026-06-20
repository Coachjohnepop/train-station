import { NextResponse } from "next/server";
import { getLandingMedia } from "@/lib/landing-media-store";
import {
  freeChastiseVideoUrlFromConfig,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";

export async function GET() {
  const config = await getLandingMedia();
  return NextResponse.json({
    welcomeVideoUrl: welcomeVideoUrlFromConfig(config.welcomeVideoUrl),
    freeChastiseVideoUrl: freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl),
    updatedAt: config.updatedAt,
    hasWelcome: Boolean(welcomeVideoUrlFromConfig(config.welcomeVideoUrl)),
    hasFreeChastise: Boolean(freeChastiseVideoUrlFromConfig(config.freeChastiseVideoUrl)),
  });
}