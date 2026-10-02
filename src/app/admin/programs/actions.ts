"use server";

import { getSessionUser, isStaffRole } from "@/lib/auth";
import { isAllowedExploreImageUrl, patchExploreContent } from "@/lib/explore-content";
import { getLandingMedia, saveLandingMedia } from "@/lib/landing-media-store";

/** Coach photo for a program — same image on Admin → Programs and landing Explore. */
export async function saveProgramImageAction(input: {
  slug: string;
  imageUrl: string | null;
}) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }

  const slug = input.slug.trim();
  if (!slug) return { error: "Missing program." };

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && !isAllowedExploreImageUrl(imageUrl)) {
    return { error: "Upload a photo here, or use an https image URL." };
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.program.updateMany({
      where: { slug },
      data: { coverUrl: imageUrl },
    });
  } catch {
    /* program row may not exist yet — still save the landing photo */
  }

  try {
    const current = await getLandingMedia();
    const next = patchExploreContent(current.exploreContent, { [slug]: { imageUrl } });
    await saveLandingMedia({ exploreContent: next });
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Could not save the program photo." };
  }

  return { ok: true as const, imageUrl };
}
