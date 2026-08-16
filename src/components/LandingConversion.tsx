"use client";

import { useEffect, useState } from "react";
import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import type { HeroSlide } from "@/lib/hero-slides";
import { openFreeQuickTour } from "@/lib/free-quick-tour";
import {
  JOIN_WEEK_HREF,
  LANDING_RETURN_EVENT,
  armLandingReturnOnLeave,
  fireLandingJoinHook,
  markLandingConverted,
} from "@/lib/landing-return-visit";

/**
 * Public landing for guests / SMS traffic.
 * Ticket theater stays in onboarding only — never lead the marketing site with seat cards.
 */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
  heroSlides = null,
  returning = false,
  rememberReturn = true,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  heroSlides?: HeroSlide[] | null;
  gagConfig?: unknown;
  returning?: boolean;
  /** Guest landing only — staff preview should not arm the return cookie. */
  rememberReturn?: boolean;
}) {
  const [liveReturn, setLiveReturn] = useState(false);
  const returnMode = returning || liveReturn;

  useEffect(() => {
    if (!rememberReturn) return;
    const onReturn = () => setLiveReturn(true);
    window.addEventListener(LANDING_RETURN_EVENT, onReturn);
    const disarm = armLandingReturnOnLeave();
    return () => {
      window.removeEventListener(LANDING_RETURN_EVENT, onReturn);
      disarm();
    };
  }, [rememberReturn]);

  return (
    <div className={`relative min-h-screen bg-black ${returnMode ? "pb-20 md:pb-0" : ""}`}>
      <ThemeAttributesSync membershipTier="explorer" />
      {/* Transparent nav over hero so SMS open is full-bleed athletes, not a grey header */}
      <LandingNav overHero />
      <LandingHero
        welcomeVideoUrl={welcomeVideoUrl}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        heroSlides={heroSlides}
        returning={returnMode}
      />
      <div className="app-shell-bg">
        <ComingSoonPrograms />
        <LandingServicesSection />
        <LandingSiteFooter />
      </div>
      {returnMode ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
          <div className="flex gap-2">
            <a
              href={JOIN_WEEK_HREF}
              data-analytics-action="sticky-join"
              onClick={(e) => {
                markLandingConverted();
                fireLandingJoinHook(e.currentTarget);
              }}
              className="landing-hero-early-signup inline-flex h-14 flex-1 items-center justify-center rounded-full text-base font-extrabold"
            >
              Join
            </a>
            <button
              type="button"
              data-analytics-action="sticky-free-tour"
              onClick={() => openFreeQuickTour()}
              className="landing-hero-secondary-cta inline-flex h-14 flex-1 items-center justify-center rounded-full text-base font-extrabold"
            >
              Free Tour
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
