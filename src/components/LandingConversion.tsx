"use client";

import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";

/** Public landing: hero + mobile ticket picker + coming-soon programs. */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
  freeChastiseVideoUrl?: string | null;
}) {
  return (
    <div className="min-h-screen bg-black">
      <LandingHero welcomeVideoUrl={welcomeVideoUrl} />
      <LandingTicketPicker freeChastiseVideoUrl={freeChastiseVideoUrl} />
      <LandingServicesSection />
      <ComingSoonPrograms />
    </div>
  );
}