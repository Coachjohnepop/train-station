"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  activeHeroSlides,
  DEFAULT_HERO_SLIDES,
  type HeroSlide,
} from "@/lib/hero-slides";

export default function SplashCarousel({
  heroSlides = null,
}: {
  heroSlides?: HeroSlide[] | null;
}) {
  const images = useMemo(() => {
    const active = activeHeroSlides(heroSlides);
    return active.length ? active : DEFAULT_HERO_SLIDES;
  }, [heroSlides]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="relative h-[65vh] min-h-[420px] w-full overflow-hidden bg-black">
      {images.map((slide, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${slide.id}-${slide.src}`}
          src={slide.src}
          alt={slide.alt || `Inspiring workout ${index + 1}`}
          style={{ objectPosition: slide.objectPosition || "center center" }}
          className={`absolute inset-0 h-full w-full object-cover brightness-[1.14] contrast-[1.04] saturate-[1.06] transition-opacity duration-1000 ease-in-out ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/12 to-black/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,transparent_70%)]" />

      <div className="relative z-10 flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-4xl">
          <h1 className="text-5xl font-bold tracking-tighter text-white sm:text-6xl md:text-7xl">
            All aboard your<br />fitness journey
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-xl text-white/80">
            Professional training programs. Real accountability. Results that last.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/member"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold transition-all hover:bg-white/90 hover:scale-[1.1]"
            >
              <span style={{ color: "#7c3aed" }}>Back to your program</span>
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#6d2dd6] hover:scale-[1.1]"
            >
              Join the site (new user flow)
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:scale-[1.1]"
            >
              Coach Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {images.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === current ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/70"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
