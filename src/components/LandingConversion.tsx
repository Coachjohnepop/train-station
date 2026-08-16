"use client";

import { useCallback, useEffect, useState } from "react";
import LandingHero from "@/components/LandingHero";
import LandingServicesSection from "@/components/LandingServicesSection";
import ComingSoonPrograms from "@/components/ComingSoonPrograms";
import LandingNav from "@/components/LandingNav";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";
import type { HeroSlide } from "@/lib/hero-slides";
import { LANDING_EXPLORE_EVENT } from "@/lib/landing-explore";
import {
  LANDING_RETURN_EVENT,
  armLandingReturnOnLeave,
} from "@/lib/landing-return-visit";

/**
 * Public landing for guests / SMS traffic.
 * Hero has three choices only: Free Tour, Start membership, Explore Content.
 * Ticket theater stays in onboarding — never lead the marketing site with seat cards.
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
  const [exploreOpen, setExploreOpen] = useState(false);
  const returnMode = returning || liveReturn;

  const revealExplore = useCallback((origin?: HTMLElement | null, celebrate = true) => {
    setExploreOpen((was) => {
      if (!was && celebrate) {
        void import("@/lib/workout-confetti").then(
          ({ buzzScoreCelebrate, confettiOriginFromElement, fireWorkoutConfetti }) => {
            buzzScoreCelebrate("standard");
            fireWorkoutConfetti(
              origin ? confettiOriginFromElement(origin) : undefined,
              1800,
            );
          },
        );
      }
      return true;
    });
    window.setTimeout(() => {
      document.getElementById("explore-content")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  }, []);

  const onExplore = useCallback(
    (origin: HTMLElement) => {
      if (exploreOpen) {
        setExploreOpen(false);
        return;
      }
      revealExplore(origin, true);
    },
    [exploreOpen, revealExplore],
  );

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

  useEffect(() => {
    const open = () => revealExplore(null, false);
    window.addEventListener(LANDING_EXPLORE_EVENT, open);
    try {
      const hash = window.location.hash;
      if (hash === "#programs" || hash === "#services" || hash === "#explore-content") {
        revealExplore(null, false);
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener(LANDING_EXPLORE_EVENT, open);
  }, [revealExplore]);

  return (
    <div className="relative min-h-screen bg-black">
      <ThemeAttributesSync membershipTier="explorer" />
      {/* Transparent nav over hero so SMS open is full-bleed athletes, not a grey header */}
      <LandingNav overHero />
      <LandingHero
        welcomeVideoUrl={welcomeVideoUrl}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        heroSlides={heroSlides}
        returning={returnMode}
        exploreOpen={exploreOpen}
        onExplore={onExplore}
      />
      <div
        id="explore-content"
        className={`grid scroll-mt-16 transition-[grid-template-rows] duration-500 ease-out ${
          exploreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="app-shell-bg">
            {welcomeVideoUrl?.trim() ? (
              <div className="border-b border-[var(--border)] px-4 py-4 text-center">
                <WelcomeVideoPopover
                  welcomeVideoUrl={welcomeVideoUrl}
                  buttonClassName="text-sm font-semibold text-[var(--accent-fg)] underline decoration-[var(--accent)]/40 underline-offset-4"
                >
                  Watch intro
                </WelcomeVideoPopover>
              </div>
            ) : null}
            <ComingSoonPrograms />
            <LandingServicesSection />
            <LandingSiteFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
