"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import TrainStationBrand from "@/components/TrainStationBrand";
import WelcomeVideoPopover from "@/components/WelcomeVideoPopover";

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

const phrases = [
  <>
    Train with
    <br />
    <span className="landing-hero-accent">Purpose.</span>
  </>,
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
];

/**
 * Cold-traffic first screen (SMS / mobile link).
 * Full viewport, cinematic athletes, one primary CTA — no ticket theater.
 */
export default function LandingHero({
  welcomeVideoUrl = null,
}: {
  welcomeVideoUrl?: string | null;
}) {
  const [tick, setTick] = useState(0);

  const TICK_MS = 2800;
  const IMAGE_TICKS = 1;

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const imageIndex = Math.floor(tick / IMAGE_TICKS) % images.length;
  const textIndex = tick % phrases.length;

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
          className={`landing-hero-slide absolute inset-0 h-full w-full object-cover object-[center_25%] sm:object-center ${
            index === imageIndex ? "landing-hero-slide--active" : "landing-hero-slide--idle"
          }`}
        />
      ))}

      {/* Cinematic grade — readable type, purple energy, not a flat void */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(124,58,237,0.42)_0%,transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/85 to-transparent" />
      <div className="landing-hero-vignette pointer-events-none absolute inset-0" />
      <div className="landing-hero-scan pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 flex min-h-[100dvh] min-h-[100svh] flex-col">
        {/* Desktop brand only — mobile uses centered lockup in stack */}
        <div className="absolute left-8 top-6 z-20 hidden md:block">
          <TrainStationBrand variant="hero" />
        </div>

        {/* Content rides the lower third on phones so the athlete face/body still reads */}
        <div className="mt-auto flex flex-1 flex-col items-center justify-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-24 text-center sm:justify-center sm:px-8 sm:pb-20 sm:pt-32">
          <div className="landing-hero-stack flex w-full max-w-lg flex-col items-center">
            <p className="landing-hero-brand-lock mb-2 text-[10px] font-extrabold uppercase tracking-[0.42em] text-[#e9d5ff] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:mb-3 sm:text-xs sm:tracking-[0.48em]">
              The Train Station
            </p>

            <h1 className="landing-hero-headline mb-3 text-[clamp(2.75rem,12vw,3.75rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-white sm:mb-4 sm:text-6xl sm:tracking-[-0.05em] md:text-7xl lg:text-8xl">
              {phrases[textIndex]}
            </h1>

            <p className="max-w-[20rem] text-[15px] font-semibold leading-snug text-white/95 sm:max-w-md sm:text-xl md:text-2xl">
              Live coaching. Real programs.
              <span className="mt-0.5 block font-medium text-white/75 sm:mt-0 sm:inline sm:before:content-['\00a0']">
                Results that stick.
              </span>
            </p>

            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c4b5fd]/90 sm:mt-4 sm:text-xs">
              Coach Jeremy · Live floor · Community
            </p>

            {/* Mobile: one hero CTA + one secondary. Desktop: full row. */}
            <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:mt-8">
              <Link
                href="/signup?plan=explorer"
                className="landing-hero-early-signup landing-hero-cta-pulse inline-flex h-14 w-full items-center justify-center rounded-full px-8 text-[17px] font-extrabold tracking-tight transition-transform active:scale-[0.98] sm:h-14 sm:text-lg"
              >
                Board free — start today
              </Link>
              <Link
                href="/join"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border-2 border-white/90 bg-white/10 px-8 text-[15px] font-bold text-white backdrop-blur-md transition hover:bg-white hover:text-[#1a0b2e] active:scale-[0.98] sm:h-12"
              >
                View memberships
              </Link>
              <div className="mt-0.5 flex items-center justify-center gap-4 text-[13px] font-semibold text-white/70">
                {welcomeVideoUrl?.trim() ? (
                  <WelcomeVideoPopover
                    welcomeVideoUrl={welcomeVideoUrl}
                    buttonClassName="underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
                    ▶ Watch intro
                  </WelcomeVideoPopover>
                ) : null}
                <Link href="/login" className="underline decoration-white/40 underline-offset-4 hover:text-white hover:decoration-white">
                  Sign in
                </Link>
              </div>
            </div>

            <p className="mt-5 text-[9px] font-bold tracking-[0.28em] text-white/45 sm:mt-6 sm:text-[10px] sm:tracking-[0.32em]">
              4-WEEK BLOCKS · PHONE OR GYM · REAL COACHING
            </p>
          </div>
        </div>
      </div>

      {/* Slide pips — clear of home indicator */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-8 sm:gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setTick(idx * IMAGE_TICKS)}
            className={`h-1 rounded-full transition-all duration-500 ${
              idx === imageIndex
                ? "w-8 bg-white shadow-[0_0_14px_rgba(255,255,255,0.75)]"
                : "w-3 bg-white/35"
            }`}
            aria-label={`View image ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
