import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import LandingConversion from "@/components/LandingConversion";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { signedInAppPath } from "@/lib/staff-access";
import { buildRootMetadata } from "@/lib/site-seo-server";
import { LANDING_RETURN_COOKIE, isLandingReturnCookie } from "@/lib/landing-return-visit";
import {
  LANDING_AB_COOKIE,
  LANDING_AB_HEADER,
  parseLandingAbVariant,
  type LandingAbVariant,
} from "@/lib/landing-ab";

/** Home share preview — driven by Admin → SEO desk. */
export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata();
}

async function resolveLandingVariant(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<LandingAbVariant> {
  const headerVariant = parseLandingAbVariant((await headers()).get(LANDING_AB_HEADER));
  if (headerVariant) return headerVariant;
  return parseLandingAbVariant(cookieStore.get(LANDING_AB_COOKIE)?.value) || "tour";
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSessionUser();

  if (session) {
    redirect(isStaffRole(session.role) ? signedInAppPath(session.role) : "/member/today");
  }

  const landingVideos = await getResolvedLandingVideos();
  const landingVariant = await resolveLandingVariant(cookieStore);

  // Cold traffic / SMS — full send POP only (no floating memberships FAB).
  const returning = isLandingReturnCookie(cookieStore.get(LANDING_RETURN_COOKIE)?.value);
  return (
    <LandingConversion
      welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
      heroSlides={landingVideos.heroSlides}
      returning={returning}
      variant={landingVariant}
      meetVideoUrl={landingVideos.welcomeVideoUrl}
    />
  );
}
