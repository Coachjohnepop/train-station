"use client";

import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import ThemeModeToggle from "@/components/ThemeModeToggle";

/** Public landing: hero + mobile ticket picker + coming-soon programs. */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
  freeChastiseVideoUrl?: string | null;
}) {
  return (
    <div className="relative min-h-screen app-shell-bg">
      <ThemeAttributesSync membershipTier="explorer" />
      <div className="absolute right-3 top-3 z-20 sm:right-6 sm:top-4">
        <ThemeModeToggle />
      </div>
      <LandingHero welcomeVideoUrl={welcomeVideoUrl} />
      <LandingTicketPicker freeChastiseVideoUrl={freeChastiseVideoUrl} />
      <LandingServicesSection />
      <ComingSoonPrograms />
    </div>
  );
}