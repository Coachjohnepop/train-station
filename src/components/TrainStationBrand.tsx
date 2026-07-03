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

  const image = (
    <Image
      src={src}
      alt={brand.brandName}
      width={display.width}
      height={display.height}
      sizes={display.sizes}
      className={`${display.className} object-contain`}
      priority={variant === "hero"}
    />
  );

  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div
          className="flex items-center justify-center rounded-full bg-white/10 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-2 ring-white/30 backdrop-blur-sm sm:p-4"
          aria-hidden
        >
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full sm:h-24 sm:w-24 md:h-28 md:w-28">
            <Image
              src={brand.logoIconUrl || src}
              alt=""
              width={224}
              height={224}
              sizes="(max-width: 640px) 96px, 160px"
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>
        <p
          className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.22em] text-white/95 sm:text-base md:text-lg"
          aria-label={brand.brandName}
        >
          {brand.brandName}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {image}
    </div>
  );
}