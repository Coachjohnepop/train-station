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
import type { PurchaseAuth } from "@/lib/member-purchase-path";
import { LANDING_EXPLORE_EVENT } from "@/lib/landing-explore";
import {
  LANDING_RETURN_EVENT,
  armLandingReturnOnLeave,
} from "@/lib/landing-return-visit";
import SiteSeenLatch from "@/components/SiteSeenLatch";
import type { LandingAbVariant } from "@/lib/landing-ab";

/**
 * Public landing for guests / SMS traffic.
 * Hero has three choices only: Start membership, How it Works, Explore Content.
 * Ticket theater stays in onboarding — never lead the marketing site with seat cards.
 */
export default function LandingConversion({
  welcomeVideoUrl = null,
  freeChastiseVideoUrl = null,
  heroSlides = null,
  returning = false,
  rememberReturn = true,
  purchaseAuth,
  variant = "tour",
  meetVideoUrl = null,
}: {
  freeChastiseVideoUrl?: string | null;
  welcomeVideoUrl?: string | null;
  heroSlides?: HeroSlide[] | null;
  gagConfig?: unknown;
  returning?: boolean;
  /** Guest landing only — staff preview should not arm the return cookie. */
  rememberReturn?: boolean;
  purchaseAuth?: PurchaseAuth;
  variant?: LandingAbVariant;
  meetVideoUrl?: string | null;
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
      const scroller = document.querySelector(".explore-feed-scroller");
      if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
      document.getElementById("explore-content")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 520);
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
    <div
      className="relative min-h-screen bg-black"
      data-landing-variant={variant}
      data-landing-explore={exploreOpen ? "open" : "closed"}
    >
      <SiteSeenLatch />
      <ThemeAttributesSync membershipTier="explorer" />
      {/* Transparent nav over hero so SMS open is full-bleed athletes, not a grey header */}
      <LandingNav overHero purchaseAuth={purchaseAuth} />
      <LandingHero
        welcomeVideoUrl={welcomeVideoUrl}
        freeChastiseVideoUrl={freeChastiseVideoUrl}
        heroSlides={heroSlides}
        returning={returnMode}
        exploreOpen={exploreOpen}
        onExplore={onExplore}
        variant={variant}
        meetVideoUrl={meetVideoUrl}
      />
      <div
        id="explore-content"
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${
          exploreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="explore-feed-scroller">
            {welcomeVideoUrl?.trim() ? (
              <div className="sticky top-2 z-20 h-0">
                <div className="flex justify-center">
                  <WelcomeVideoPopover
                    welcomeVideoUrl={welcomeVideoUrl}
                    buttonClassName="rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4"
                  >
                    Watch intro
                  </WelcomeVideoPopover>
                </div>
              </div>
            ) : null}
            <ComingSoonPrograms feed />
            <LandingServicesSection />
            <div className="explore-feed-card explore-feed-card--footer">
              <LandingSiteFooter />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
