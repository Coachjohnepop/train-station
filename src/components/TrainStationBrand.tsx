"use client";

import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";
import {
  DEFAULT_FAVICON_URL,
  DEFAULT_LOGO_URL,
  brandLogoDisplay,
  type BrandLogoVariant,
  type ResolvedSiteBrand,
} from "@/lib/site-brand";
import { useSiteBrand } from "@/components/SiteBrandProvider";

const WORDMARK: Record<Exclude<BrandLogoVariant, "icon">, string> = {
  hero: "text-lg font-semibold tracking-[0.12em] text-white/95 sm:text-xl",
  compact: "text-base font-semibold tracking-[0.1em] text-white sm:text-lg",
  header: "text-sm font-semibold tracking-[0.08em] text-[#f2ecf9]",
};

function resolveBrand(
  brand: ResolvedSiteBrand | null,
  overrides?: Partial<ResolvedSiteBrand>,
): ResolvedSiteBrand {
  const base = brand ?? {
    brandName: BRAND_NAME,
    brandTagline: "",
    logoUrl: DEFAULT_LOGO_URL,
    logoIconUrl: DEFAULT_FAVICON_URL,
    faviconUrl: DEFAULT_FAVICON_URL,
    hasCustomLogo: false,
    updatedAt: "",
  };
  return { ...base, ...overrides };
}

export default function TrainStationBrand({
  variant = "hero",
  className = "",
  brand: brandOverride,
  showWordmarkFallback = true,
}: {
  variant?: BrandLogoVariant;
  className?: string;
  brand?: Partial<ResolvedSiteBrand>;
  showWordmarkFallback?: boolean;
}) {
  const contextBrand = useSiteBrand();
  const brand = resolveBrand(contextBrand, brandOverride);
  const display = brandLogoDisplay(variant);
  const src = variant === "icon" ? brand.logoIconUrl : brand.logoUrl;

  if (!src && showWordmarkFallback && variant !== "icon") {
    return (
      <p className={`${WORDMARK[variant]} ${className}`} aria-label={brand.brandName}>
        {brand.brandName}
      </p>
    );
  }

  if (variant === "hero") {
    // Stacked circle + wordmark, left-aligned (hero places this in the left column).
    // Solid white plate so the dark logo mark stays readable on dark landing chrome.
    return (
      <div className={`flex flex-col items-start ${className}`}>
        <div
          className="flex items-center justify-center rounded-full bg-white p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-2 ring-white/80 sm:p-3"
          aria-hidden
        >
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white sm:h-20 sm:w-20 md:h-24 md:w-24">
            <Image
              src={brand.logoIconUrl || src}
              alt=""
              width={224}
              height={224}
              sizes="(max-width: 640px) 80px, 112px"
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>
        <p
          className="mt-3 max-w-[11rem] text-left text-xs font-semibold uppercase tracking-[0.2em] text-white/95 sm:mt-4 sm:max-w-none sm:text-sm md:text-base"
          aria-label={brand.brandName}
        >
          {brand.brandName}
        </p>
      </div>
    );
  }

  // Header / compact / icon: white circular plate (Jeremy: logo needs a white background).
  const plateSize =
    variant === "icon"
      ? "h-9 w-9 p-0.5"
      : variant === "header"
        ? "h-9 w-9 p-0.5 sm:h-10 sm:w-10"
        : "h-14 w-14 p-1 sm:h-16 sm:w-16";

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/10 ${plateSize}`}
      >
        <Image
          src={src}
          alt={brand.brandName}
          width={display.width}
          height={display.height}
          sizes={display.sizes}
          className="h-full w-full object-contain"
          priority={variant === "compact"}
        />
      </div>
    </div>
  );
}