"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import TrainStationBrand from "@/components/TrainStationBrand";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";
import LandingSeeInsideTour from "@/components/LandingSeeInsideTour";

const images = [
  { src: "/images/splash/black-guy.jpg", alt: "Athlete powering through a heavy lift" },
  {
    src: "/images/splash/blonde-girl.jpg",
    alt: "Athlete on cable lat pulldowns in Train Station gear",
  },
  {
    src: "/images/splash/hispanic-split-squat.jpg",
    alt: "Athlete hitting Bulgarian split squats",
  },
  { src: "/images/splash/asian-woman.jpg", alt: "Athlete in an intense training session" },
];

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
 * Ask = See inside (guided tour) → exits into /join tickets or programs.
 * Members never hit this shell (home is welcome + status after join).
 */
export default function LandingHero({
  welcomeVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
  /** @deprecated Tour no longer hosts free ticket; kept optional for callers. */
  freeChastiseVideoUrl?: string | null;
}) {
  const [imageTick, setImageTick] = useState(0);
  const [phraseTick, setPhraseTick] = useState(0);
  const [canRotateCopy, setCanRotateCopy] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Images can crossfade immediately
  useEffect(() => {
    const id = window.setInterval(() => setImageTick((t) => t + 1), 3200);
    return () => window.clearInterval(id);
  }, []);

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

  const imageIndex = imageTick % images.length;
  const headline = canRotateCopy ? ROTATING[phraseTick % ROTATING.length] : FIRST_HEADLINE;

  return (
    <section
      className="landing-hero relative z-0 isolate min-h-[100dvh] min-h-[100svh] w-full overflow-hidden bg-black"
      aria-label="The Train Station"
    >
      {images.map((image, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          fetchPriority={index === 0 ? "high" : "low"}
          className={`landing-hero-slide absolute inset-0 h-full w-full object-cover object-[center_22%] sm:object-center ${
            index === imageIndex ? "landing-hero-slide--active" : "landing-hero-slide--idle"
          }`}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/30 to-black/92" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_32%,rgba(124,58,237,0.38)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black via-black/88 to-transparent" />
      <div className="landing-hero-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-[100dvh] min-h-[100svh] flex-col">
        <div className="absolute left-8 top-6 z-20 hidden md:block">
          <TrainStationBrand variant="hero" />
        </div>

        <div className="mt-auto flex flex-1 flex-col items-center justify-end px-5 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+3.5rem))] pt-28 text-center sm:justify-center sm:px-8 sm:pb-24 sm:pt-32">
          <div className="landing-hero-stack flex w-full max-w-md flex-col items-center sm:max-w-lg">
            <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.4em] text-[#e9d5ff] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] sm:mb-3 sm:text-[11px] sm:tracking-[0.45em]">
              The Train Station
            </p>

            <h1 className="landing-hero-headline mb-3 text-[clamp(2.85rem,12.5vw,3.85rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-white sm:mb-4 sm:text-6xl sm:tracking-[-0.05em] md:text-7xl">
              {headline}
            </h1>

            <p className="max-w-[18.5rem] text-[15px] font-semibold leading-snug text-white/95 sm:max-w-sm sm:text-xl">
              Coach Jeremy. Real programs.
              <span className="mt-1 block font-medium text-white/72 sm:mt-0 sm:inline sm:before:content-['\00a0']">
                On your phone.
              </span>
            </p>

            {/* Single primary ask: guided tour, not free signup */}
            <div className="mt-7 w-full max-w-sm sm:mt-9">
              <button
                type="button"
                onClick={() => setTourOpen(true)}
                className="landing-hero-early-signup landing-hero-cta-pulse inline-flex h-[3.5rem] w-full items-center justify-center rounded-full px-8 text-[17px] font-extrabold tracking-tight transition-transform active:scale-[0.98] sm:h-14 sm:text-lg"
              >
                See inside
              </button>
              <p className="mt-2.5 text-center text-[12px] font-medium text-white/55">
                Quick tour · then tickets or programs on the site
              </p>

              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-semibold text-white/70">
                <Link
                  href="/join?from=tour#tickets"
                  className="underline decoration-white/35 underline-offset-[5px] transition hover:text-white hover:decoration-white"
                >
                  Choose your ticket
                </Link>
                <span className="text-white/30" aria-hidden>
                  ·
                </span>
                <Link
                  href="/login"
                  className="underline decoration-white/35 underline-offset-[5px] transition hover:text-white hover:decoration-white"
                >
                  Member sign in
                </Link>
                {welcomeVideoUrl?.trim() ? (
                  <>
                    <span className="text-white/30" aria-hidden>
                      ·
                    </span>
                    <WelcomeVideoPopover
                      welcomeVideoUrl={welcomeVideoUrl}
                      buttonClassName="underline decoration-white/35 underline-offset-[5px] transition hover:text-white hover:decoration-white"
                    >
                      Watch intro
                    </WelcomeVideoPopover>
                  </>
                ) : null}
              </p>
            </div>
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
