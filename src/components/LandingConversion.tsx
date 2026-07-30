"use client";

import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";

/**
 * Public landing for guests / SMS traffic.
 * Ticket theater stays in onboarding only — never lead the marketing site with seat cards.
 */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  gagConfig?: unknown;
}) {
  return (
    <div className="relative min-h-screen bg-black">
      <ThemeAttributesSync membershipTier="explorer" />
      {/* Transparent nav over hero so SMS open is full-bleed athletes, not a grey header */}
      <LandingNav overHero />
      <LandingHero
        welcomeVideoUrl={welcomeVideoUrl}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
      />
      <div className="app-shell-bg">
        <ComingSoonPrograms />
        <LandingServicesSection />
        <LandingSiteFooter />
      </div>
    </div>
  );
}
