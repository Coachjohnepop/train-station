"use client";

import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingNav from "@/components/LandingNav";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";

/** Public landing: hero + mobile ticket picker + coming-soon programs. */
export default function LandingConversion({
  freeChastiseVideoUrl = null,
}: {
  freeChastiseVideoUrl?: string | null;
}) {
  return (
    <div className="relative min-h-screen app-shell-bg">
      <ThemeAttributesSync membershipTier="explorer" />
      <LandingNav />
      <LandingHero />
      <LandingTicketPicker freeChastiseVideoUrl={freeChastiseVideoUrl} />
      <LandingServicesSection />
      <ComingSoonPrograms />
    </div>
  );
}