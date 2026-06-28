import { Suspense } from "react";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getSessionUser } from "@/lib/auth";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [session, landingVideos] = await Promise.all([
    getSessionUser(),
    getResolvedLandingVideos(),
  ]);

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
      />
    </Suspense>
  );
}