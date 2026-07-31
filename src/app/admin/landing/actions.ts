"use server";

import { getSessionUser, isStaffRole } from "@/lib/auth";
import {
  getLandingMedia,
  saveLandingMedia,
  type HeroSlide,
  type WelcomeVideosByPlan,
} from "@/lib/landing-media-store";
import {
  getMemberContent,
  saveMemberContent,
  type NutritionCalorieTier,
} from "@/lib/member-content-store";
import { resolveSiteBrand } from "@/lib/site-brand";
import type { LogoTransform } from "@/lib/logo-transform";
import { getSiteBrand, saveSiteBrand } from "@/lib/site-brand-store";

export async function saveLandingMediaAction(input: {
  welcomeVideoUrl?: string | null;
  welcomeVideosByPlan?: WelcomeVideosByPlan;
  freeChastiseVideoUrl?: string | null;
  heroSlides?: HeroSlide[];
  gagVideoUrl?: string | null;
  gagStartSec?: number;
  gagDurationSec?: number;
  gagEnabled?: boolean;
  purchaseThankYouVideoUrl?: string | null;
  equipmentIntroVideoUrl?: string | null;
  measurementsIntroVideoUrl?: string | null;
  /** Relative volume for uploaded intros, steps of 3 dB from native. */
  uploadedContentVolumeDb?: number;
  venmoQrUrl?: string | null;
  venmoHandle?: string | null;
  venmoInstructions?: string | null;
}) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }

  try {
    const config = await saveLandingMedia({
      welcomeVideoUrl: input.welcomeVideoUrl,
      welcomeVideosByPlan: input.welcomeVideosByPlan,
      freeChastiseVideoUrl: input.freeChastiseVideoUrl,
      heroSlides: input.heroSlides,
      gagVideoUrl: input.gagVideoUrl,
      gagStartSec: input.gagStartSec,
      gagDurationSec: input.gagDurationSec,
      gagEnabled: input.gagEnabled,
      purchaseThankYouVideoUrl: input.purchaseThankYouVideoUrl,
      equipmentIntroVideoUrl: input.equipmentIntroVideoUrl,
      measurementsIntroVideoUrl: input.measurementsIntroVideoUrl,
      uploadedContentVolumeDb: input.uploadedContentVolumeDb,
      venmoQrUrl: input.venmoQrUrl,
      venmoHandle: input.venmoHandle,
      venmoInstructions: input.venmoInstructions,
    });
    return {
      ok: true as const,
      storedWelcomeVideoUrl: config.welcomeVideoUrl,
      storedWelcomeVideosByPlan: config.welcomeVideosByPlan,
      storedFreeChastiseVideoUrl: config.freeChastiseVideoUrl,
      storedHeroSlides: config.heroSlides,
      storedGagVideoUrl: config.gagVideoUrl,
      storedGagStartSec: config.gagStartSec,
      storedGagDurationSec: config.gagDurationSec,
      storedGagEnabled: config.gagEnabled,
      storedPurchaseThankYouVideoUrl: config.purchaseThankYouVideoUrl,
      storedEquipmentIntroVideoUrl: config.equipmentIntroVideoUrl,
      storedMeasurementsIntroVideoUrl: config.measurementsIntroVideoUrl,
      storedUploadedContentVolumeDb: config.uploadedContentVolumeDb,
      storedVenmoQrUrl: config.venmoQrUrl,
      storedVenmoHandle: config.venmoHandle,
      storedVenmoInstructions: config.venmoInstructions,
      updatedAt: config.updatedAt,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

/** Save only hero carousel slides (Admin → Landing hero editor). */
export async function saveHeroSlidesAction(slides: HeroSlide[]) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }
  try {
    const config = await saveLandingMedia({ heroSlides: slides });
    return {
      ok: true as const,
      storedHeroSlides: config.heroSlides,
      updatedAt: config.updatedAt,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

/** @deprecated Use saveLandingMediaAction */
export async function saveLandingVideosAction(input: {
  welcomeVideoUrl: string | null;
  freeChastiseVideoUrl: string | null;
}) {
  return saveLandingMediaAction(input);
}

export async function saveSiteBrandAction(input: {
  brandName?: string;
  brandTagline?: string;
  logoUrl?: string | null;
  logoIconUrl?: string | null;
  faviconUrl?: string | null;
  logoSourceUrl?: string | null;
  logoTransform?: LogoTransform;
}) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }

  try {
    const config = await saveSiteBrand(input);
    const brand = resolveSiteBrand(config);
    return {
      ok: true as const,
      ...brand,
      storedBrandName: config.brandName,
      storedBrandTagline: config.brandTagline,
      storedLogoUrl: config.logoUrl,
      storedLogoIconUrl: config.logoIconUrl,
      storedFaviconUrl: config.faviconUrl,
      storedLogoSourceUrl: config.logoSourceUrl,
      logoTransform: config.logoTransform,
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
    storedVenmoQrUrl: config.venmoQrUrl,
    storedVenmoHandle: config.venmoHandle,
    storedVenmoInstructions: config.venmoInstructions,
    updatedAt: config.updatedAt,
  };
}

export async function saveMemberContentAction(input: {
  weeklyVideoUrl: string | null;
  weeklyVideoTitle: string;
  dinnerVideoUrl: string | null;
  dinnerVideoTitle: string;
  dailyInspirationClips?: import("@/lib/member-content-store").DailyInspirationClip[];
  nutritionIntro: string;
  nutritionTiers: NutritionCalorieTier[];
}) {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { error: "Coach sign-in required. Sign out and sign in again at /login." };
  }

  try {
    const config = await saveMemberContent(input);
    return {
      ok: true as const,
      storedWeeklyVideoUrl: config.weeklyVideoUrl,
      storedWeeklyVideoTitle: config.weeklyVideoTitle,
      storedDinnerVideoUrl: config.dinnerVideoUrl,
      storedDinnerVideoTitle: config.dinnerVideoTitle,
      storedDailyInspirationClips: config.dailyInspirationClips,
      storedNutritionIntro: config.nutritionIntro,
      storedNutritionTiers: config.nutritionTiers,
      updatedAt: config.updatedAt,
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}