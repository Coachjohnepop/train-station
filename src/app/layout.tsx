import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import BackgroundMusic from "@/components/BackgroundMusic";
import ThemeAttributesSync from "@/components/ThemeAttributesSync";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_TAGLINE,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} app-shell-bg`} suppressHydrationWarning>
      <body className="app-shell-bg">
        <ThemeAttributesSync membershipTier="explorer" />
        {children}
        <BackgroundMusic />
      </body>
    </html>
  );
}