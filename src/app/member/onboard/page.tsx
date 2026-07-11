import { Suspense } from "react";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getSessionUser } from "@/lib/auth";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { getCoachSettings } from "@/lib/coach-settings-store";
import { programStartSettingsFromCoach } from "@/lib/program-start-settings";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [session, landingVideos, coachSettings] = await Promise.all([
    getSessionUser(),
    getResolvedLandingVideos(),
    getCoachSettings(),
  ]);
  const programStartSettings = programStartSettingsFromCoach(coachSettings);

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
      />
    </Suspense>
  );
}