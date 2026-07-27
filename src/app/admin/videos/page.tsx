import AdminSiteVideosPanel from "@/components/AdminSiteVideosPanel";
import { getLandingMedia } from "@/lib/landing-media-store";
import { getMemberContent } from "@/lib/member-content-store";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [landing, member] = await Promise.all([getLandingMedia(), getMemberContent()]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every site video Jeremy and staff manage — free gag, intros, purchase thank-you, weekly,
          dinner, and daily inspiration.
        </p>
      </div>
      <AdminSiteVideosPanel
        initialWelcomeUrl={landing.welcomeVideoUrl ?? ""}
        initialWelcomeVideosByPlan={landing.welcomeVideosByPlan}
        initialFreeUrl={landing.freeChastiseVideoUrl ?? ""}
        initialGagUrl={landing.gagVideoUrl ?? ""}
        initialGagStartSec={landing.gagStartSec}
        initialGagDurationSec={landing.gagDurationSec}
        initialGagEnabled={landing.gagEnabled}
        initialPurchaseThankYouUrl={landing.purchaseThankYouVideoUrl ?? ""}
        initialWeeklyUrl={member.weeklyVideoUrl ?? ""}
        initialWeeklyTitle={member.weeklyVideoTitle}
        initialDinnerUrl={member.dinnerVideoUrl ?? ""}
        initialDinnerTitle={member.dinnerVideoTitle}
        initialDailyClips={member.dailyInspirationClips}
        initialNutritionIntro={member.nutritionIntro}
        initialNutritionTiers={member.nutritionTiers}
      />
    </div>
  );
}
