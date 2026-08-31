import AdminSiteVideosPanel from "@/components/AdminSiteVideosPanel";
import {
  freeChastiseVideoUrlFromConfig,
  welcomeVideoUrlFromConfig,
} from "@/lib/landing-media";
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
  const welcomeUrl = welcomeVideoUrlFromConfig(landing.welcomeVideoUrl);
  const freeUrl = freeChastiseVideoUrlFromConfig(landing.freeChastiseVideoUrl);
  const library = await ensureLibraryHasUrls([
    { url: welcomeUrl, title: "Overall intro" },
    { url: freeUrl, title: "Free Explorer intro" },
    { url: landing.equipmentIntroVideoUrl, title: "Gear / equipment intro" },
    { url: landing.measurementsIntroVideoUrl, title: "Measurements how-to" },
    ...planTitles,
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tap Upload video on a slot — it goes live when the green bar says so. Phone Photos and
          Camera (.MOV) work. Free Explorer is the clip after the gag. Thank-you, weekly, dinner,
          daily can still be YouTube.
        </p>
      </div>
      <AdminSiteVideosPanel
        initialWelcomeUrl={welcomeUrl}
        initialWelcomeVideosByPlan={landing.welcomeVideosByPlan}
        initialFreeUrl={freeUrl}
        initialGagUrl={landing.gagVideoUrl ?? ""}
        initialGagStartSec={landing.gagStartSec}
        initialGagDurationSec={landing.gagDurationSec}
        initialGagEnabled={landing.gagEnabled}
        initialPurchaseThankYouUrl={landing.purchaseThankYouVideoUrl ?? ""}
        initialEquipmentIntroUrl={landing.equipmentIntroVideoUrl ?? ""}
        initialMeasurementsIntroUrl={landing.measurementsIntroVideoUrl ?? ""}
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
