import { Suspense } from "react";
import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getSessionUser } from "@/lib/auth";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";
import { getMemberProfile } from "@/lib/member-profiles-store";
import { memberPostOnboardPathAsync } from "@/lib/member-destinations";
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
  let initialGender: string | null = null;
  if (session?.id) {
    const [profile, user] = await Promise.all([
      getMemberProfile(session.id),
      prisma.user
        .findUnique({ where: { id: session.id }, select: { signupPlan: true } })
        .catch(() => null),
    ]);
    if (profile?.onboardingComplete) {
      redirect(await memberPostOnboardPathAsync(profile, session.id, ""));
    }
    initialPlan = resolveEffectiveMembershipPlan({
      profilePlan: profile?.plan,
      signupPlan: user?.signupPlan,
      paymentStatus: profile?.paymentStatus,
    });
    initialGender = profile?.gender ?? null;
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
        initialGender={initialGender}
      />
    </Suspense>
  );
}