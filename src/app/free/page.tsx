import type { Metadata } from "next";
import Link from "next/link";
import FreeTicketGiftLanding from "@/components/FreeTicketGiftLanding";
import LandingSiteFooter from "@/components/LandingSiteFooter";
import { getResolvedLandingVideos } from "@/lib/landing-media-server";
import {
  FREE_GAG_OG_DESCRIPTION,
  FREE_GAG_OG_IMAGE,
  FREE_GAG_OG_TITLE,
  FREE_GAG_SHARE_PATH,
} from "@/lib/free-gag-share";
import { absoluteSeoUrl } from "@/lib/site-seo-store";
import { siteOrigin } from "@/lib/site-seo-server";

export async function generateMetadata(): Promise<Metadata> {
  const origin = siteOrigin();
  const url = `${origin}${FREE_GAG_SHARE_PATH}`;
  const image = absoluteSeoUrl(FREE_GAG_OG_IMAGE, origin);

  return {
    title: { absolute: FREE_GAG_OG_TITLE },
    description: FREE_GAG_OG_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: "The Train Station",
      title: FREE_GAG_OG_TITLE,
      description: FREE_GAG_OG_DESCRIPTION,
      images: [
        {
          url: image,
          width: 1600,
          height: 1067,
          alt: "Free Explorer ticket — The Train Station",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: FREE_GAG_OG_TITLE,
      description: FREE_GAG_OG_DESCRIPTION,
      images: [image],
    },
  };
}

export default async function FreeTicketSharePage() {
  const landingVideos = await getResolvedLandingVideos();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:text-[var(--accent)]">
            The Train Station
          </Link>
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Sign in
          </Link>
        </div>
      </header>

      <FreeTicketGiftLanding
        freeChastiseVideoUrl={landingVideos.freeChastiseVideoUrl}
        welcomeVideoUrl={landingVideos.welcomeVideoUrl}
        gagFullSrc={landingVideos.freeTicketFullUrl}
      />

      <LandingSiteFooter />
    </div>
  );
}
