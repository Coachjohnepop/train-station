import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingConversion from "@/components/LandingConversion";
import LandingNav from "@/components/LandingNav";
import LandingServicesSection from "@/components/LandingServicesSection";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import LandingWelcomeBanner from "@/components/LandingWelcomeBanner";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import LandingMemberStatus from "@/components/LandingMemberStatus";
import {
  getMemberMembershipSnapshot,
  isEstablishedMember,
} from "@/lib/member-membership";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { signupPlanLabel } from "@/lib/signup-plans";
import { buildRootMetadata } from "@/lib/site-seo-server";

/** Home share preview — driven by Admin → SEO desk. */
export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata();
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSessionUser();
  const landingVideos = await getResolvedLandingVideos();

  // Staff: same public POP landing cold traffic sees — never ticket theater.
  if (session && isStaffRole(session.role)) {
    const demoUser = resolveDemoUser(session.id);
    const displayName =
      session.name ||
      demoUser?.name ||
      cookieStore.get(MEMBER_NAME_COOKIE)?.value ||
      "Coach";
    return (
      <>
        <div
          className="force-dark sticky top-0 z-50 border-b border-[#7c3aed]/40 bg-[#1a0b2e]/95 px-3 py-2 text-center backdrop-blur-md sm:px-4"
          data-force-dark
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs sm:justify-between sm:text-sm">
            <p className="text-white/80">
              Signed in as <span className="font-semibold text-white">{displayName}</span>
              <span className="hidden text-white/50 sm:inline">
                {" "}
                · this is the public landing members see
              </span>
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-[#7c3aed]/35 transition hover:bg-[#6d28d9]"
            >
              Coach admin →
            </Link>
          </div>
        </div>
        <LandingConversion
          welcomeVideoUrl={landingVideos.welcomeVideoUrl}
          freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
          heroSlides={landingVideos.heroSlides}
        />
      </>
    );
  }

  if (session) {
    const demoUser = resolveDemoUser(session.id);
    const displayName =
      session.name ||
      demoUser?.name ||
      cookieStore.get(MEMBER_NAME_COOKIE)?.value ||
      "Member";
    const email = session.email || demoUser?.email;
    const profile =
      session.role === "MEMBER" ? await getMemberProfile(session.id) : null;
    const membershipPlan = profile?.plan ?? "explorer";
    const themeTier = membershipThemeTierFromPlan(profile?.plan);
    const established = isEstablishedMember(profile);
    let membershipSnapshot: Awaited<ReturnType<typeof getMemberMembershipSnapshot>> = null;
    if (established && profile) {
      try {
        membershipSnapshot = await getMemberMembershipSnapshot(session.id);
      } catch (e: unknown) {
        console.error(
          "[home] membership snapshot failed (showing welcome fallback):",
          e instanceof Error ? e.message : e,
        );
      }
    }

    return (
      <div className="min-h-screen app-shell-bg">
        <ThemeAttributesSync membershipTier={themeTier} />
        <LandingNav
          variant="welcome"
          purchaseAuth={{ signedIn: true, role: session.role }}
        />
        {established && membershipSnapshot ? (
          <LandingMemberStatus
            membership={membershipSnapshot}
            displayName={displayName}
            email={email}
            welcomeVideoUrl={landingVideos.welcomeVideoUrl}
          />
        ) : (
          <LandingWelcomeBanner
            displayName={displayName}
            email={email}
            isCoach={false}
            membershipPlan={membershipPlan}
            membershipPlanLabel={profile ? signupPlanLabel(profile.plan) : null}
            isEstablishedMember={established}
            welcomeVideoUrl={landingVideos.welcomeVideoUrl}
          />
        )}
        <ComingSoonPrograms />
        <LandingServicesSection purchaseAuth={{ signedIn: true, role: session.role }} />
        {/* No landing ticket grid — plans at /join; ticket art only in onboarding. */}
        {!established && (
          <div className="border-t border-[var(--border)] px-4 py-10 text-center">
            <p className="text-sm text-[var(--muted)]">Ready for a full membership?</p>
            <Link
              href="/join"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#7c3aed] px-6 text-sm font-semibold text-white hover:bg-[#6d28d9]"
            >
              View memberships →
            </Link>
          </div>
        )}
        <LandingSiteFooter />
      </div>
    );
  }

  // Cold traffic / SMS — full send POP only (no floating memberships FAB).
  return (
    <LandingConversion
      welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
      heroSlides={landingVideos.heroSlides}
    />
  );
}
