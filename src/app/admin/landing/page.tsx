import AdminHeroImagesPanel from "@/components/AdminHeroImagesPanel";
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
        Hero carousel photos or videos (crop + slow-mo), logo, name, tagline, and Venmo.
      </p>
      <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-xs text-[var(--muted)]">
        <p className="font-semibold text-violet-100">Where things live</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <strong className="text-violet-50">Hero images &amp; videos</strong> — full-screen
            landing carousel, crop, slow-mo (below)
          </li>
          <li>Logo / brand + Venmo QR (below)</li>
          <li>
            All site <strong className="text-violet-50">videos</strong> →{" "}
            <a href="/admin/videos" className="text-accent hover:underline">
              Admin → Videos
            </a>
          </li>
        </ol>
      </div>
      <div className="mt-8 space-y-12">
        <AdminHeroImagesPanel initialSlides={config.heroSlides} />
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