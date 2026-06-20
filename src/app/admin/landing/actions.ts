"use server";

import { getSessionUser, isStaffRole } from "@/lib/auth";
import { getLandingMedia, saveLandingMedia } from "@/lib/landing-media-store";

export async function saveLandingVideosAction(input: {
  welcomeVideoUrl: string | null;
  freeChastiseVideoUrl: string | null;
}) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }

  try {
    const config = await saveLandingMedia({
      welcomeVideoUrl: input.welcomeVideoUrl,
      freeChastiseVideoUrl: input.freeChastiseVideoUrl,
    });
    return {
      ok: true as const,
      storedWelcomeVideoUrl: config.welcomeVideoUrl,
      storedFreeChastiseVideoUrl: config.freeChastiseVideoUrl,
      updatedAt: config.updatedAt,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function loadLandingVideosAction() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }
  const config = await getLandingMedia();
  return {
    ok: true as const,
    storedWelcomeVideoUrl: config.welcomeVideoUrl,
    storedFreeChastiseVideoUrl: config.freeChastiseVideoUrl,
    updatedAt: config.updatedAt,
  };
}