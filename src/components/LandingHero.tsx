"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const images = [
  { src: "/images/splash/black-guy.jpg", alt: "Fit Black guy powering through a workout" },
  { src: "/images/splash/curly-girl.jpg", alt: "Curly haired white girl in dynamic fitness pose" },
  { src: "/images/splash/diverse-man.jpg", alt: "Athletic diverse man in professional training session" },
  { src: "/images/splash/asian-woman.jpg", alt: "Hot Asian young woman in intense workout" },
];

const phrases = [
  <>Train with<br />Purpose.</>,
  <>Train with<br />Passion.</>,
  <>Train with<br />Goals.</>,
  <>Train with<br />Commitment.</>,
];

export default function LandingHero() {
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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {images.map((image, index) => (
        <img
          key={index}
          src={image.src}
          alt={image.alt}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
            index === imageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      
      {/* Professional dark gradient overlays for text legibility and depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.3)_0%,transparent_60%)]" />
      
      {/* Logo in top-left corner - stylish branding */}
      <div className="absolute top-8 left-8 z-30">
        <Link href="/member">
          <img
            src="/images/logo.png"
            alt="The Train Station"
            className="h-[11.25rem] w-auto drop-shadow-2xl"
          />
        </Link>
      </div>

      {/* Centered hero content - clean, professional, inspiring */}
      <div className="relative z-10 flex h-full items-center justify-center px-6">
        <div className="max-w-5xl text-center">
          <h1 className="mb-6 text-6xl font-semibold tracking-[-2.5px] text-white sm:text-7xl md:text-8xl leading-[0.9]">
            {phrases[textIndex]}
          </h1>
          
          <p className="mx-auto max-w-2xl text-xl text-white/80 md:text-2xl tracking-tight">
            Professional-grade programs. Real accountability.<br />Results that actually last.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a 
              href="/member" 
              className="inline-flex h-14 items-center justify-center rounded-full bg-white px-10 text-sm font-bold !text-[#7c3aed] transition-all hover:bg-white hover:scale-[1.1] active:scale-[0.985]"
            >
              Start Training
            </a>
            <a 
              href="/join" 
              className="inline-flex h-14 items-center justify-center rounded-full bg-[#7c3aed] px-10 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-[#6d2dd6] hover:scale-[1.1] active:scale-[0.985]"
            >
              Join the site
            </a>
            <a 
              href="/admin" 
              className="inline-flex h-14 items-center justify-center rounded-full border border-white/40 px-10 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/10 hover:scale-[1.1] active:scale-[0.985]"
            >
              For Coaches
            </a>
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
