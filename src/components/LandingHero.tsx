"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import TrainStationBrand from "@/components/TrainStationBrand";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";

const images = [
  { src: "/images/splash/black-guy.jpg", alt: "Fit Black athlete powering through a heavy lift" },
  {
    src: "/images/splash/blonde-girl.jpg",
    alt: "Blonde athlete doing cable lat pulldowns in blue and white Train Station gear",
  },
  {
    src: "/images/splash/hispanic-split-squat.jpg",
    alt: "Latino athlete in white and baby blue gear doing Bulgarian split squats",
  },
  { src: "/images/splash/asian-woman.jpg", alt: "Athletic woman in an intense workout" },
];

const phrases = [
  <>
    Train with
    <br />
    Purpose.
  </>,
  <>
    Train with
    <br />
    Passion.
  </>,
  <>
    Train with
    <br />
    Goals.
  </>,
  <>
    Train with
    <br />
    Commitment.
  </>,
];

export default function LandingHero({
  welcomeVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
}) {
  const [tick, setTick] = useState(0);

  const TICK_MS = 2250;
  const IMAGE_TICKS = 2;
  const TEXT_TICKS = 1;

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const imageIndex = Math.floor(tick / IMAGE_TICKS) % images.length;
  const textIndex = Math.floor(tick / TEXT_TICKS) % phrases.length;

  function scrollToTickets() {
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="relative z-0 isolate min-h-[100svh] w-full overflow-hidden bg-black">
      {images.map((image, index) => (
        <img
          key={index}
          src={image.src}
          alt={image.alt}
          className={`absolute inset-0 h-full w-full object-cover brightness-[1.14] contrast-[1.04] saturate-[1.06] transition-opacity duration-1000 ease-in-out ${
            index === imageIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.12)_0%,transparent_68%)]" />

      <div className="relative z-10 min-h-[100svh]">
        {/* Brand mark — desktop only (nav already has logo on phones) */}
        <div className="absolute left-8 top-6 z-20 hidden sm:left-10 sm:top-8 md:block">
          <TrainStationBrand variant="hero" />
        </div>

        {/* Center stack — tighter on mobile so CTAs aren’t crushed */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-end px-5 pb-16 pt-24 text-center sm:justify-center sm:px-8 sm:pb-24 sm:pt-40 md:pt-24">
          <div className="flex w-full max-w-lg flex-col items-center">
            <h1 className="mb-3 text-[2.75rem] font-semibold leading-[0.92] tracking-[-1.5px] text-white sm:mb-4 sm:text-6xl sm:tracking-[-2.5px] md:text-7xl lg:text-8xl">
              {phrases[textIndex]}
            </h1>

            <p className="max-w-md text-base leading-snug tracking-tight text-white/85 sm:max-w-2xl sm:text-xl md:text-2xl">
              Professional-grade programs. Real accountability.
              <span className="hidden sm:inline"> Results that actually last.</span>
            </p>

            {/* Primary actions — one column on phone, no overlapping pills */}
            <div className="mt-7 flex w-full flex-col gap-2.5 sm:mt-8 sm:max-w-md">
              <Link
                href="/signup?plan=explorer"
                className="landing-hero-early-signup inline-flex h-12 w-full items-center justify-center rounded-full px-8 text-[15px] font-bold shadow-lg transition-all active:scale-[0.98] sm:h-12"
              >
                Early sign up
              </Link>
              <button
                type="button"
                onClick={scrollToTickets}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#7c3aed] px-8 text-[15px] font-bold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:bg-[#6d2dd6] active:scale-[0.98]"
              >
                View memberships
              </button>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/30 bg-black/25 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Member sign in
              </Link>
            </div>

            {welcomeVideoUrl?.trim() ? (
              <div className="mt-4 flex flex-col items-center gap-1">
                <WelcomeVideoPopover
                  welcomeVideoUrl={welcomeVideoUrl}
                  buttonClassName="inline-flex h-10 items-center justify-center rounded-full border border-white/35 bg-black/20 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 active:scale-[0.98]"
                >
                  Watch intro
                </WelcomeVideoPopover>
              </div>
            ) : null}

            <p className="mt-6 text-[10px] font-medium tracking-[0.18em] text-white/45 sm:mt-8 sm:text-xs sm:tracking-widest">
              4-WEEK PROGRAMS · LIVE · COMMUNITY
            </p>
          </div>
        </div>
      </div>

      {/* Slide indicators — higher on mobile so they clear the speaker FAB */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-10 sm:gap-3">
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setTick(idx * IMAGE_TICKS)}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === imageIndex ? "w-8 bg-white" : "w-4 bg-white/35 hover:bg-white/55"
            }`}
            aria-label={`View image ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
