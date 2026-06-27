import Link from "next/link";
import { cookies } from "next/headers";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { MEMBER_NAME_COOKIE } from "@/lib/current-user";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingConversion from "@/components/LandingConversion";
import LandingNav from "@/components/LandingNav";
import LandingServicesSection from "@/components/LandingServicesSection";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import LandingWelcomeBanner from "@/components/LandingWelcomeBanner";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = await getSessionUser();
  const landingVideos = await getResolvedLandingVideos();

  if (session) {
    const demoUser = resolveDemoUser(session.id);
    const displayName =
      session.name ||
      demoUser?.name ||
      cookieStore.get(MEMBER_NAME_COOKIE)?.value ||
      "Member";
    const email = session.email || demoUser?.email;
    const isCoach = isStaffRole(session.role);

    return (
      <div className="min-h-screen app-shell-bg">
        <ThemeAttributesSync membershipTier="explorer" />
        <LandingNav variant="welcome" />
        <LandingWelcomeBanner
          displayName={displayName}
          email={email}
          isCoach={isCoach}
          welcomeVideoUrl={landingVideos.welcomeVideoUrl}
        />
        <LandingTicketPicker freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl} />
        <LandingServicesSection />
        <ComingSoonPrograms />
      </div>
    );
  }

  return (
    <>
      <LandingConversion freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl} />

      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <Link
          href="#tickets"
          className="group inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] shadow-xl backdrop-blur-md transition-all hover:border-[var(--accent)] hover:shadow-2xl active:scale-[0.985]"
        >
          View memberships
          <span className="text-[var(--accent)] transition group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </>
  );
}