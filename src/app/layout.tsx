import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getResolvedSiteBrand } from "@/lib/site-brand-server";
import BackgroundMusic from "@/components/BackgroundMusic";
import { SiteBrandProvider } from "@/components/SiteBrandProvider";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import GlobalThemeToggle from "@/components/GlobalThemeToggle";
import AnalyticsTrackerRoot from "@/components/AnalyticsTrackerRoot";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

/** Link-preview / SMS share image — training energy, not a ticket grid. */
const SITE_OG_IMAGE = {
  url: "/images/splash/black-guy.jpg",
  width: 1200,
  height: 1600,
  alt: "Athlete training hard — The Train Station",
} as const;

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.thetrainstation.co"
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedSiteBrand();
  const title = brand.brandName || BRAND_NAME;
  const description =
    brand.brandTagline ||
    BRAND_TAGLINE ||
    "Live coaching, real programs, results that stick. Board The Train Station.";
  const origin = siteOrigin();
  const shareTitle = `${title} — Train with purpose`;
  const shareDescription =
    "Live coaching with Coach Jeremy · real programs · a community that shows up. Board free or pick your ticket.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: shareTitle,
      template: `%s · ${title}`,
    },
    description: shareDescription,
    applicationName: title,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title,
    },
    icons: {
      icon: brand.faviconUrl,
      shortcut: brand.faviconUrl,
      apple: brand.logoIconUrl,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: origin,
      siteName: title,
      title: shareTitle,
      description: shareDescription,
      images: [SITE_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: [SITE_OG_IMAGE.url],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getResolvedSiteBrand();

  return (
    <html lang="en" className={`${geist.variable} app-shell-bg`} suppressHydrationWarning>
      <body className="app-shell-bg">
        <SiteBrandProvider brand={brand}>
          <ThemeAttributesSync membershipTier="explorer" />
          <GlobalThemeToggle />
          {children}
          <AnalyticsTrackerRoot />
          <BackgroundMusic />
        </SiteBrandProvider>
      </body>
    </html>
  );
}