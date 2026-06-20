"use client";

import LandingHero from "@/components/LandingHero";
import LandingTicketPicker from "@/components/LandingTicketPicker";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";

/** Public landing: hero + mobile ticket picker + coming-soon programs. */
export default function LandingConversion() {
  return (
    <div className="min-h-screen bg-black">
      <LandingHero />
      <LandingTicketPicker />
      <ComingSoonPrograms />
    </div>
  );
}