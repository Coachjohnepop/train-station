import { Suspense } from "react";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getAdminContact } from "@/lib/booking";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import { COACH_CALENDLY_URL } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [{ welcomeVideoUrl }, contact] = await Promise.all([
    getResolvedLandingVideos(),
    getAdminContact(),
  ]);

  const calendlyUrl =
    (contact as { calendlyUrl?: string | null }).calendlyUrl || COACH_CALENDLY_URL;

  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-6 text-center text-sm text-[var(--muted)]">
          Loading setup…
        </div>
      }
    >
      <OnboardingWizard welcomeVideoUrl={welcomeVideoUrl} calendlyUrl={calendlyUrl} />
    </Suspense>
  );
}