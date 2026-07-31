import "server-only";

import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { getResolvedSiteBrand } from "@/lib/site-brand-server";
import {
  absoluteSeoUrl,
  getSiteSeo,
  type SiteSeoConfig,
} from "@/lib/site-seo-store";

export function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

export async function getSiteSeoResolved(): Promise<SiteSeoConfig & { origin: string }> {
  const seo = await getSiteSeo();
  return { ...seo, origin: siteOrigin() };
}

/**
 * Root layout metadata from SEO desk (+ brand name for template).
 */
export async function buildRootMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSiteSeo(), getResolvedSiteBrand()]);
  const origin = siteOrigin();
  const brandName = brand.brandName || BRAND_NAME;
  const title = seo.metaTitle || `${brandName} — Train with purpose`;
  const description = seo.metaDescription;
  const ogTitle = seo.ogTitle || title;
  const ogDescription = seo.ogDescription || description;
  const ogImage = absoluteSeoUrl(seo.ogImageUrl, origin);

  const verification: Metadata["verification"] = {};
  if (seo.googleSiteVerification) {
    verification.google = seo.googleSiteVerification;
  }
  if (seo.bingSiteVerification) {
    verification.other = {
      ...(verification.other as Record<string, string> | undefined),
      "msvalidate.01": seo.bingSiteVerification,
    };
  }

  const robots: Metadata["robots"] = seo.robotsIndex
    ? {
        index: true,
        follow: seo.robotsFollow,
        googleBot: {
          index: true,
          follow: seo.robotsFollow,
        },
      }
    : {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      };

  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: `%s · ${brandName}`,
    },
    description,
    applicationName: brandName,
    keywords: seo.keywords
      ? seo.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brandName,
    },
    icons: {
      icon: brand.faviconUrl,
      shortcut: brand.faviconUrl,
      apple: brand.logoIconUrl,
    },
    robots,
    verification: Object.keys(verification).length ? verification : undefined,
    openGraph: {
      type: "website",
      locale: "en_US",
      url: origin,
      siteName: brandName,
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 1600,
          alt: seo.ogImageAlt || brandName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}
