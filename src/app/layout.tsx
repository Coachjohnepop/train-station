import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { getResolvedSiteBrand } from "@/lib/site-brand-server";
import { buildRootMetadata } from "@/lib/site-seo-server";
import BackgroundMusic from "@/components/BackgroundMusic";
import { SiteBrandProvider } from "@/components/SiteBrandProvider";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import GlobalThemeToggle from "@/components/GlobalThemeToggle";
import AnalyticsTrackerRoot from "@/components/AnalyticsTrackerRoot";
import SiteJsonLd from "@/components/SiteJsonLd";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

/**
 * Snap the app to the device screen — no pinch-zoom “resize”, no sideways slide.
 * viewport-fit=cover so safe-area insets work in standalone / notch phones.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0612" },
    { media: "(prefers-color-scheme: light)", color: "#f4effb" },
  ],
};

/** SEO desk (Admin → SEO) drives title, description, OG, robots, verification. */
export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata();
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
          <SiteJsonLd />
          {children}
          <AnalyticsTrackerRoot />
          <BackgroundMusic />
        </SiteBrandProvider>
      </body>
    </html>
  );
}