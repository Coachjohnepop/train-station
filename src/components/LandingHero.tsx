"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import TrainStationBrand from "@/components/TrainStationBrand";
import LandingSignInRow from "@/components/LandingSignInRow";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";

const images = [
  { src: "/images/splash/black-guy.jpg", alt: "Fit Black athlete powering through a heavy lift" },
  { src: "/images/splash/blonde-girl.jpg", alt: "Blonde athlete doing cable lat pulldowns in blue and white Train Station gear" },
  { src: "/images/splash/hispanic-split-squat.jpg", alt: "Latino athlete in white and baby blue gear doing Bulgarian split squats" },
  { src: "/images/splash/asian-woman.jpg", alt: "Athletic woman in an intense workout" },
];

const phrases = [
  <>Train with<br />Purpose.</>,
  <>Train with<br />Passion.</>,
  <>Train with<br />Goals.</>,
  <>Train with<br />Commitment.</>,
];

export default function LandingHero({
  welcomeVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
}) {
  const [tick, setTick] = useState(0);

  // Rotation: text changes "as fast" (every half image) but offset by 1/2 of the image scroll.
  // I.e. phrases rotate 1/2 way through each photo's display (every 1/2 measure), as originally requested.
  // Tick drives both for sync. Base tick: 2250ms.
  // Photos advance every 2 ticks => 4500ms per photo (crossfade).
  // Phrases advance every 1 tick => 2250ms per phrase, but phased to flip in the middle of each photo.
  // Result: during each photo, the text changes exactly halfway through its display time.
  const TICK_MS = 2250;
  const IMAGE_TICKS = 2; // 4500ms / photo
  const TEXT_TICKS = 1;  // 2250ms / phrase (text twice as fast as images, offset by half)

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
            index === imageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.12)_0%,transparent_68%)]" />

      {/*
        3-zone placement (browser):
        - Left: logo circle + "THE TRAIN STATION"
        - Center: rotating headline + everything below (true page center)
        - Right: empty balance (logo is out of the flow so center stays centered)
      */}
      <div className="relative z-10 min-h-[100svh]">
        {/* Left zone — brand high and left; does not push center content off-middle */}
        <div className="absolute left-5 top-5 z-20 sm:left-8 sm:top-6 md:left-10 md:top-8">
          <TrainStationBrand variant="hero" />
        </div>

        {/* Center zone — full-width centered stack (title through CTAs) */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center px-5 pb-20 pt-[9.5rem] text-center sm:px-8 sm:pt-40 md:justify-center md:pt-24 md:pb-24">
          <h1 className="mb-3 text-5xl font-semibold leading-[0.9] tracking-[-2px] text-white sm:mb-4 sm:text-6xl sm:tracking-[-2.5px] md:text-7xl lg:text-8xl">
            {phrases[textIndex]}
          </h1>

          <p className="max-w-2xl text-lg tracking-tight text-white/80 sm:text-xl md:text-2xl">
            Professional-grade programs. Real accountability.
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Results that actually last.
          </p>

          {welcomeVideoUrl?.trim() ? (
            <div className="mt-5 flex flex-col items-center gap-1 sm:mt-6">
              <WelcomeVideoPopover welcomeVideoUrl={welcomeVideoUrl}>
                Watch intro
              </WelcomeVideoPopover>
              <a
                href={welcomeVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/70 hover:text-white hover:underline"
              >
                YouTube link →
              </a>
            </div>
          ) : null}

          <div className="mt-5 flex w-full max-w-md flex-col items-center gap-3 sm:mt-6">
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:flex-wrap">
              <Link
                href="/signup?plan=explorer"
                className="landing-hero-early-signup inline-flex h-11 w-full items-center justify-center rounded-full px-8 text-sm font-bold shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98] sm:h-12 sm:w-auto sm:px-10"
              >
                Early sign up
              </Link>
              <button
                type="button"
                onClick={scrollToTickets}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#7c3aed] px-8 text-sm font-bold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:scale-[1.05] hover:bg-[#6d2dd6] active:scale-[0.98] sm:h-12 sm:w-auto sm:px-10"
              >
                Pick your ticket ↓
              </button>
            </div>
            <Link
              href="/login"
              className="inline-flex h-11 w-full max-w-sm items-center justify-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Member sign in
            </Link>
            <LandingSignInRow hideMemberSignIn />
          </div>

          <p className="mt-5 text-xs tracking-widest text-white/50 sm:mt-6">
            4-WEEK PROGRAMS • LIVE SESSIONS • COMMUNITY
          </p>
        </div>
      </div>

      {/* Elegant slide indicators */}
      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 gap-3">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setTick(idx * IMAGE_TICKS)}
            className={`h-px w-8 transition-all duration-300 ${
              idx === imageIndex ? 'bg-white w-12' : 'bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`View image ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
