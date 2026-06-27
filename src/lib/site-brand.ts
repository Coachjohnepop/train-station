import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import type { SiteBrandConfig } from "@/lib/site-brand-store";

export const DEFAULT_LOGO_URL = "/images/logo.png";
export const DEFAULT_LOGO_ICON_URL = "/images/logo-icon.png";
export const DEFAULT_FAVICON_URL = "/favicon.png";

export type ResolvedSiteBrand = {
  brandName: string;
  brandTagline: string;
  logoUrl: string;
  logoIconUrl: string;
  faviconUrl: string;
  hasCustomLogo: boolean;
  updatedAt: string;
};

export function resolveSiteBrand(config: SiteBrandConfig): ResolvedSiteBrand {
  const logoUrl = config.logoUrl?.trim() || DEFAULT_LOGO_URL;
  const logoIconUrl = config.logoIconUrl?.trim() || config.logoUrl?.trim() || DEFAULT_LOGO_ICON_URL;
  const faviconUrl = config.faviconUrl?.trim() || config.logoIconUrl?.trim() || DEFAULT_FAVICON_URL;

  return {
    brandName: config.brandName?.trim() || BRAND_NAME,
    brandTagline: config.brandTagline?.trim() || BRAND_TAGLINE,
    logoUrl,
    logoIconUrl,
    faviconUrl,
    hasCustomLogo: Boolean(config.logoUrl?.trim()),
    updatedAt: config.updatedAt,
  };
}

export type BrandLogoVariant = "hero" | "compact" | "header" | "icon";

const LOGO_DISPLAY: Record<
  Exclude<BrandLogoVariant, "icon">,
  { className: string; width: number; height: number; sizes: string }
> = {
  hero: {
    className: "h-16 w-auto sm:h-20 md:h-24",
    width: 320,
    height: 320,
    sizes: "(max-width: 640px) 160px, 240px",
  },
  compact: {
    className: "h-12 w-auto sm:h-14",
    width: 240,
    height: 240,
    sizes: "(max-width: 640px) 120px, 180px",
  },
  header: {
    className: "h-8 w-auto sm:h-9",
    width: 160,
    height: 160,
    sizes: "(max-width: 640px) 96px, 128px",
  },
};

const ICON_DISPLAY = {
  className: "h-8 w-8",
  width: 128,
  height: 128,
  sizes: "32px",
};

export function brandLogoDisplay(variant: BrandLogoVariant) {
  if (variant === "icon") return ICON_DISPLAY;
  return LOGO_DISPLAY[variant];
}