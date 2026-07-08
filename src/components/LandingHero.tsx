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

      {/* Centered hero content - clean, professional, inspiring */}
      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="max-w-5xl text-center">
          <TrainStationBrand variant="hero" className="mb-8" />
          <h1 className="mb-6 text-6xl font-semibold tracking-[-2.5px] text-white sm:text-7xl md:text-8xl leading-[0.9]">
            {phrases[textIndex]}
          </h1>
          
          <p className="mx-auto max-w-2xl text-xl text-white/80 md:text-2xl tracking-tight">
            Professional-grade programs. Real accountability.<br />Results that actually last.
          </p>

          {welcomeVideoUrl?.trim() ? (
            <div className="mt-8">
              <WelcomeVideoPopover welcomeVideoUrl={welcomeVideoUrl}>
                Watch intro
              </WelcomeVideoPopover>
            </div>
          ) : null}
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4">
            <Link
              href="/signup?plan=explorer"
              className="landing-hero-early-signup inline-flex h-12 items-center justify-center rounded-full px-10 text-sm font-bold shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              Early sign up
            </Link>
            <button
              type="button"
              onClick={scrollToTickets}
              className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] px-10 text-sm font-bold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:bg-[#6d2dd6] hover:scale-[1.05] active:scale-[0.98]"
            >
              Pick your ticket ↓
            </button>
            <Link
              href="/login"
              className="inline-flex h-11 w-full max-w-sm items-center justify-center rounded-full border border-white/35 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Member sign in
            </Link>
            <LandingSignInRow hideMemberSignIn />
          </div>
          
          <p className="mt-8 text-xs text-white/50 tracking-widest">4-WEEK PROGRAMS • LIVE SESSIONS • COMMUNITY</p>
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
