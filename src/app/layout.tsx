import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getResolvedSiteBrand } from "@/lib/site-brand-server";
import BackgroundMusic from "@/components/BackgroundMusic";
import { SiteBrandProvider } from "@/components/SiteBrandProvider";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedSiteBrand();
  return {
    title: brand.brandName || BRAND_NAME,
    description: brand.brandTagline || BRAND_TAGLINE,
    icons: {
      icon: brand.faviconUrl,
      shortcut: brand.faviconUrl,
      apple: brand.logoIconUrl,
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
          {children}
          <BackgroundMusic />
        </SiteBrandProvider>
      </body>
    </html>
  );
}