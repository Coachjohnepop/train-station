import AdminSiteVideosPanel from "@/components/AdminSiteVideosPanel";
import { getLandingMedia } from "@/lib/landing-media-store";
import { getMemberContent } from "@/lib/member-content-store";
import { ensureLibraryHasUrls } from "@/lib/site-video-library-store";
import {
  MEMBERSHIP_PLANS,
  signupPlanLabel,
  type MembershipPlan,
} from "@/lib/signup-plans";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [landing, member] = await Promise.all([getLandingMedia(), getMemberContent()]);

  // Pull currently assigned intros into the library so the coach can reassign them by name.
  // Free Explorer is one slot (freeChastise); skip duplicate explorer plan title if same URL.
  const planTitles = MEMBERSHIP_PLANS.filter((plan) => plan !== "explorer").map(
    (plan: MembershipPlan) => ({
      url: landing.welcomeVideosByPlan[plan],
      title: `${signupPlanLabel(plan)} intro`,
    }),
  );
  const library = await ensureLibraryHasUrls([
    { url: landing.welcomeVideoUrl, title: "Overall intro" },
    { url: landing.freeChastiseVideoUrl, title: "Free Explorer intro" },
    { url: landing.equipmentIntroVideoUrl, title: "Gear / equipment intro" },
    ...planTitles,
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload or replace Jeremy&apos;s intros on each slot, watch them here, then Save. Free
          Explorer is the clip after the fixed gag. YouTube for thank-you, weekly, dinner, daily.
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
        initialEquipmentIntroUrl={landing.equipmentIntroVideoUrl ?? ""}
        initialWeeklyUrl={member.weeklyVideoUrl ?? ""}
        initialWeeklyTitle={member.weeklyVideoTitle}
        initialDinnerUrl={member.dinnerVideoUrl ?? ""}
        initialDinnerTitle={member.dinnerVideoTitle}
        initialDailyClips={member.dailyInspirationClips}
        initialNutritionIntro={member.nutritionIntro}
        initialNutritionTiers={member.nutritionTiers}
        initialLibrary={library.items}
        initialUploadedContentVolumeDb={landing.uploadedContentVolumeDb}
      />
    </div>
  );
}
