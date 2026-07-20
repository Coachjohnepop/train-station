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
import LandingMemberStatus from "@/components/LandingMemberStatus";
import {
  getMemberMembershipSnapshot,
  isEstablishedMember,
} from "@/lib/member-membership";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { membershipThemeTierFromPlan } from "@/lib/membership-theme";
import { signupPlanLabel } from "@/lib/signup-plans";

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
    const profile =
      session.role === "MEMBER" ? await getMemberProfile(session.id) : null;
    const membershipPlan = profile?.plan ?? (isCoach ? null : "explorer");
    const themeTier = membershipThemeTierFromPlan(profile?.plan);
    const established = isEstablishedMember(profile);
    const membershipSnapshot =
      established && profile ? await getMemberMembershipSnapshot(session.id) : null;

    return (
      <div className="min-h-screen app-shell-bg">
        <ThemeAttributesSync membershipTier={themeTier} />
        <LandingNav
          variant="welcome"
          purchaseAuth={{ signedIn: true, role: session.role }}
        />
        {established && membershipSnapshot && !isCoach ? (
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
            isCoach={isCoach}
            membershipPlan={membershipPlan}
            membershipPlanLabel={profile ? signupPlanLabel(profile.plan) : null}
            isEstablishedMember={established}
            welcomeVideoUrl={landingVideos.welcomeVideoUrl}
          />
        )}
        {established && membershipSnapshot ? null : (
          <LandingTicketPicker
            freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
            welcomeVideoUrl={landingVideos.welcomeVideoUrl}
            purchaseAuth={{ signedIn: true, role: session.role }}
          />
        )}
        <LandingServicesSection purchaseAuth={{ signedIn: true, role: session.role }} />
        <ComingSoonPrograms />
      </div>
    );
  }

  return (
    <>
      <LandingConversion
        freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
        welcomeVideoUrl={landingVideos.welcomeVideoUrl}
      />

      {/* Desktop only — hero already has View memberships on phones */}
      <div className="home-memberships-fab fixed z-30 hidden flex-col items-end gap-2 md:flex">
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