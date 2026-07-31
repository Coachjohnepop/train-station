"use client";

import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import type { HeroSlide } from "@/lib/hero-slides";

/**
 * Public landing for guests / SMS traffic.
 * Ticket theater stays in onboarding only — never lead the marketing site with seat cards.
 */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
  heroSlides = null,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  heroSlides?: HeroSlide[] | null;
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
        heroSlides={heroSlides}
      />
      <div className="app-shell-bg">
        <ComingSoonPrograms />
        <LandingServicesSection />
        <LandingSiteFooter />
      </div>
    </div>
  );
}
