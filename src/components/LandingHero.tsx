"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import LandingSeeInsideTour from "@/components/LandingSeeInsideTour";
import { FREE_QUICK_TOUR_EVENT } from "@/lib/free-quick-tour";
import HeroSlideMedia from "@/components/HeroSlideMedia";
import {
  activeHeroSlides,
  DEFAULT_HERO_SLIDES,
  heroSlideHoldMs,
  heroSlideShouldLoadMedia,
  type HeroSlide,
} from "@/lib/hero-slides";
import {
  JOIN_TICKETS_HREF,
  LANDING_RETURN_EVENT,
  fireLandingJoinHook,
  markLandingConverted,
  trackLandingCustom,
} from "@/lib/landing-return-visit";
import EasyPathChoices from "@/components/EasyPathChoices";

/** Locked first headline so SMS open doesn’t fight a rotating word. */
const FIRST_HEADLINE = (
  <>
    Train with
    <br />
    <span className="landing-hero-accent">Purpose.</span>
  </>
);

const ROTATING = [
  <>
    Train with
    <br />
    <span className="landing-hero-accent">Passion.</span>
  </>,
  <>
    Train with
    <br />
    <span className="landing-hero-accent">Goals.</span>
  </>,
  <>
    Train with
    <br />
    <span className="landing-hero-accent">Fire.</span>
  </>,
  FIRST_HEADLINE,
];

/**
 * Cold-traffic “send POP” screen — one promise, one ask.
 * Ask = Free Quick Tour → exits into /join tickets or programs.
 * Members never hit this shell (home is welcome + status after join).
 */
export default function LandingHero({
  welcomeVideoUrl: _welcomeVideoUrl = null,
  heroSlides = null,
  returning = false,
  exploreOpen = false,
  onExplore,
}: {
  welcomeVideoUrl?: string | null;
  /** @deprecated Tour no longer hosts free ticket; kept optional for callers. */
  freeChastiseVideoUrl?: string | null;
  /** From Admin → Landing hero editor. Falls back to built-in defaults. */
  heroSlides?: HeroSlide[] | null;
  /** Second+ visit or hamburger-abandon — lead with tickets, not the tour. */
  returning?: boolean;
  exploreOpen?: boolean;
  onExplore?: (origin: HTMLElement) => void;
}) {
  const [imageTick, setImageTick] = useState(0);
  const [phraseTick, setPhraseTick] = useState(0);
  const [canRotateCopy, setCanRotateCopy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [liveReturn, setLiveReturn] = useState(false);
  const returnMode = returning || liveReturn;

  const images = useMemo(() => {
    const active = activeHeroSlides(heroSlides);
    return active.length ? active : DEFAULT_HERO_SLIDES;
  }, [heroSlides]);

  useEffect(() => {
    if (!returnMode) return;
    trackLandingCustom("landing_return_shown");
  }, [returnMode]);

  useEffect(() => {
    const onReturn = () => setLiveReturn(true);
    window.addEventListener(LANDING_RETURN_EVENT, onReturn);
    return () => window.removeEventListener(LANDING_RETURN_EVENT, onReturn);
  }, []);

  // Nav "Free Tour" + deep link ?tour=1 open the same overlay as the hero CTA.
  useEffect(() => {
    const open = () => setTourOpen(true);
    window.addEventListener(FREE_QUICK_TOUR_EVENT, open);

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tour") === "1" || params.get("openTour") === "1") {
        setTourOpen(true);
        params.delete("tour");
        params.delete("openTour");
        const next = params.toString();
        const clean = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash || ""}`;
        window.history.replaceState({}, "", clean);
      }
    } catch {
      /* ignore */
    }

    return () => window.removeEventListener(FREE_QUICK_TOUR_EVENT, open);
  }, []);

  // Photos hold ~3.2s; video slides hold longer so slow-mo is visible.
  useEffect(() => {
    if (images.length <= 1) return;
    const current = images[imageTick % images.length];
    const ms = current ? heroSlideHoldMs(current) : 3200;
    const id = window.setTimeout(() => setImageTick((t) => t + 1), ms);
    return () => window.clearTimeout(id);
  }, [images, imageTick]);

  // Hold “Purpose.” for first ~3.2s so the ask is stable on open
  useEffect(() => {
    const unlock = window.setTimeout(() => setCanRotateCopy(true), 3200);
    return () => window.clearTimeout(unlock);
  }, []);

  useEffect(() => {
    if (!canRotateCopy) return;
    const id = window.setInterval(() => setPhraseTick((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, [canRotateCopy]);

  const imageIndex = images.length ? imageTick % images.length : 0;
  const headline = returnMode ? (
    <>
      Still here?
      <br />
      <span className="landing-hero-accent">Pick a seat.</span>
    </>
  ) : canRotateCopy ? (
    ROTATING[phraseTick % ROTATING.length]
  ) : (
    FIRST_HEADLINE
  );

  return (
    <section
      className="landing-hero force-dark relative z-0 isolate min-h-[100dvh] min-h-[100svh] w-full overflow-hidden bg-black"
      data-force-dark
      aria-label="The Train Station"
    >
      {images.map((image, index) => (
        <div
          key={`${image.id}-${image.src}`}
          className={`landing-hero-slide absolute inset-0 overflow-hidden ${
            index === imageIndex ? "landing-hero-slide--active" : "landing-hero-slide--idle"
          }`}
        >
          {heroSlideShouldLoadMedia(index, imageIndex, images.length, image) ? (
            <HeroSlideMedia
              slide={image}
              active={index === imageIndex}
              className="h-full w-full object-cover sm:object-center"
              fetchPriority={index === imageIndex ? "high" : "low"}
            />
          ) : (
            <div className="h-full w-full bg-black" aria-hidden />
          )}
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/30 to-black/92" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_32%,rgba(124,58,237,0.38)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black via-black/88 to-transparent" />
      <div className="landing-hero-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-[100dvh] min-h-[100svh] flex-col">
        <div className={`flex flex-1 flex-col items-center px-5 pt-24 text-center sm:px-8 sm:pt-28 ${
          returnMode
            ? "pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+6.25rem))]"
            : "pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+4.5rem))]"
        }`}>
          <div className="landing-hero-stack flex w-full max-w-md flex-col items-center sm:max-w-lg">
            <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.4em] text-[#e9d5ff] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] sm:mb-3 sm:text-[11px] sm:tracking-[0.45em]">
              The Train Station
            </p>

            <div className="w-full max-w-sm">
              <EasyPathChoices
                kicker=""
                hint={
                  returnMode
                    ? "Free peek first · or pick a ticket"
                    : "Tour is ~15 sec · Free is a real seat"
                }
              >
                <button
                  type="button"
                  data-analytics-action={returnMode ? "hero-free-tour-return" : "hero-free-tour"}
                  onClick={() => setTourOpen(true)}
                  className="landing-hero-secondary-cta inline-flex h-[3.5rem] w-full items-center justify-center rounded-full px-8 text-[17px] font-extrabold tracking-tight transition-transform active:scale-[0.98] sm:h-14 sm:text-lg"
                >
                  Free Tour
                </button>
                <Link
                  href={JOIN_TICKETS_HREF}
                  data-analytics-action={returnMode ? "hero-start-membership-return" : "hero-start-membership"}
                  onClick={(e) => {
                    markLandingConverted();
                    fireLandingJoinHook(e.currentTarget);
                  }}
                  className="landing-hero-early-signup inline-flex h-[3.5rem] w-full items-center justify-center rounded-full px-8 text-[17px] font-extrabold tracking-tight transition-transform active:scale-[0.98] sm:h-14 sm:text-lg"
                >
                  Start membership
                </Link>
                <button
                  type="button"
                  data-analytics-action="hero-explore-content"
                  aria-expanded={exploreOpen}
                  aria-controls="explore-content"
                  onClick={(e) => onExplore?.(e.currentTarget)}
                  className="landing-hero-explore-cta inline-flex h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-full px-8 text-[16px] font-extrabold tracking-tight transition-transform active:scale-[0.98] sm:h-14 sm:text-lg"
                >
                  Explore Content
                  <span
                    className={`landing-hero-explore-caret ${exploreOpen ? "landing-hero-explore-caret--open" : ""}`}
                    aria-hidden
                  />
                </button>
              </EasyPathChoices>
            </div>

            <h1 className="landing-hero-headline mt-8 mb-3 text-[clamp(2.85rem,12.5vw,3.85rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-white sm:mt-10 sm:mb-4 sm:text-6xl sm:tracking-[-0.05em] md:text-7xl">
              {headline}
            </h1>

            <p className="max-w-[18.5rem] text-[15px] font-semibold leading-snug text-white/95 sm:max-w-sm sm:text-xl">
              {returnMode ? (
                <>
                  You already found us.
                  <span className="mt-1 block font-medium text-white/72 sm:mt-0 sm:inline sm:before:content-['\00a0']">
                    Board in one tap.
                  </span>
                </>
              ) : (
                <>
                  Coach Jeremy. Real programs.
                  <span className="mt-1 block font-medium text-white/72 sm:mt-0 sm:inline sm:before:content-['\00a0']">
                    On your phone.
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[max(0.65rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-7">
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setImageTick(idx)}
            className={`pointer-events-auto h-1 rounded-full transition-all duration-500 ${
              idx === imageIndex
                ? "w-7 bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]"
                : "w-2.5 bg-white/30"
            }`}
            aria-label={`View image ${idx + 1}`}
          />
        ))}
      </div>

      <LandingSeeInsideTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </section>
  );
}
