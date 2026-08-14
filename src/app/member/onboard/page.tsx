import { Suspense } from "react";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getSessionUser } from "@/lib/auth";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { resolveEffectiveMembershipPlan } from "@/lib/signup-plans";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [session, landingVideos, coachSettings] = await Promise.all([
    getSessionUser(),
    getResolvedLandingVideos(),
    getCoachSettings(),
  ]);
  const programStartSettings = programStartSettingsFromCoach(coachSettings);
  let initialPlan: string | undefined;
  if (session?.id) {
    const [profile, user] = await Promise.all([
      getMemberProfile(session.id),
      prisma.user
        .findUnique({ where: { id: session.id }, select: { signupPlan: true } })
        .catch(() => null),
    ]);
    initialPlan = resolveEffectiveMembershipPlan({
      profilePlan: profile?.plan,
      signupPlan: user?.signupPlan,
      paymentStatus: profile?.paymentStatus,
    });
  }

  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-6 text-center text-sm text-[var(--muted)]">
          Loading setup…
        </div>
      }
    >
      <OnboardingWizard
        email={session?.email || ""}
        welcomeVideoUrl={landingVideos.welcomeVideoUrl}
        welcomeVideosByPlan={landingVideos.welcomeVideosByPlan}
        programStartSettings={programStartSettings}
        initialPlan={initialPlan}
      />
    </Suspense>
  );
}