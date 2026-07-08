import AdminLandingMediaPanel from "@/components/AdminLandingMediaPanel";
import AdminMemberContentPanel from "@/components/AdminMemberContentPanel";
import AdminSiteBrandPanel from "@/components/AdminSiteBrandPanel";
import { getLandingMedia } from "@/lib/landing-media-store";
import { getMemberContent } from "@/lib/member-content-store";
import { resolveSiteBrand } from "@/lib/site-brand";
import { getSiteBrand } from "@/lib/site-brand-store";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const [config, brandConfig, memberContent] = await Promise.all([
    getLandingMedia(),
    getSiteBrand(),
    getMemberContent(),
  ]);
  const brand = resolveSiteBrand(brandConfig);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Site brand & landing media</h1>
      <p className="mt-2 text-[var(--muted)]">
        Logo, name, and tagline for white-label resale — plus YouTube links and Venmo QR for the
        home page.
      </p>
      <div className="mt-8 space-y-12">
        <AdminSiteBrandPanel
          initialBrandName={brandConfig.brandName}
          initialBrandTagline={brandConfig.brandTagline}
          initialLogoUrl={brandConfig.logoUrl ?? ""}
          initialLogoIconUrl={brandConfig.logoIconUrl ?? ""}
          initialFaviconUrl={brandConfig.faviconUrl ?? ""}
          initialLogoSourceUrl={brandConfig.logoSourceUrl ?? "/images/logo-source.png"}
          initialLogoTransform={brandConfig.logoTransform}
          resolvedLogoUrl={brand.logoUrl}
          resolvedLogoIconUrl={brand.logoIconUrl}
          resolvedFaviconUrl={brand.faviconUrl}
        />
        <AdminLandingMediaPanel
          initialWelcomeUrl={config.welcomeVideoUrl ?? ""}
          initialWelcomeVideosByPlan={config.welcomeVideosByPlan}
          initialFreeUrl={config.freeChastiseVideoUrl ?? ""}
          initialVenmoQrUrl={config.venmoQrUrl ?? ""}
          initialVenmoHandle={config.venmoHandle ?? ""}
          initialVenmoInstructions={config.venmoInstructions ?? ""}
        />
        <AdminMemberContentPanel
          initialWeeklyUrl={memberContent.weeklyVideoUrl ?? ""}
          initialWeeklyTitle={memberContent.weeklyVideoTitle}
          initialDinnerUrl={memberContent.dinnerVideoUrl ?? ""}
          initialDinnerTitle={memberContent.dinnerVideoTitle}
          initialNutritionIntro={memberContent.nutritionIntro}
          initialNutritionTiers={memberContent.nutritionTiers}
        />
      </div>
    </div>
  );
}