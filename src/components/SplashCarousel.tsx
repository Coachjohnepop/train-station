"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const images = [
  "/images/splash/black-guy.jpg",
  "/images/splash/curly-girl.jpg",
  "/images/splash/diverse-man.jpg",
  "/images/splash/asian-woman.jpg",
];

export default function SplashCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-[65vh] min-h-[420px] w-full overflow-hidden bg-black">
      {images.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={`Inspiring workout ${index + 1}`}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* Overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.2)_0%,transparent_70%)]" />
      
      {/* Logo in top-left corner - stylish branding */}
      <div className="absolute left-4 sm:left-8 z-30 splash-safe-top">
        <Link href="/member">
          <img
            src="/images/logo.png"
            alt="The Train Station"
            className="h-12 w-auto drop-shadow-2xl sm:h-16 md:h-24"
          />
        </Link>
      </div>

      {/* Hero content */}
      <div className="relative z-10 flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl md:text-6xl lg:text-7xl">
            All aboard your<br />fitness journey
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base sm:text-xl text-white/80">
            Professional training programs. Real accountability. Results that last.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="/member"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold !text-[#7c3aed] transition-all active:scale-[0.985] hover:bg-white/90 hover:scale-[1.03] min-h-[48px]"
            >
              Enter as Member
            </a>
            <a
              href="/join"
              className="inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-8 py-3 text-sm font-semibold text-white transition-all active:scale-[0.985] hover:bg-[#6d2dd6] hover:scale-[1.03] min-h-[48px]"
            >
              Join the site
            </a>
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 text-sm font-semibold text-white transition-all active:scale-[0.985] hover:bg-white/10 hover:scale-[1.03] min-h-[48px]"
            >
              Coach Admin
            </a>
          </div>
        </div>
      </div>

      {/* Subtle indicators */}
      <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all touch-manipulation ${idx === current ? "w-8 bg-white" : "w-2 bg-white/50 active:bg-white/70"}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
