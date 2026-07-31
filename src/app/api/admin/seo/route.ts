import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/api-auth";
import {
  getSiteSeo,
  saveSiteSeo,
  SEO_PUBLIC_PATHS,
  siteSeoDefaults,
} from "@/lib/site-seo-store";
import { siteOrigin } from "@/lib/site-seo-server";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(320).optional(),
  ogTitle: z.string().max(120).optional(),
  ogDescription: z.string().max(320).optional(),
  ogImageUrl: z.string().max(500).optional(),
  ogImageAlt: z.string().max(200).optional(),
  keywords: z.string().max(400).optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  googleSiteVerification: z.string().max(120).optional(),
  bingSiteVerification: z.string().max(120).optional(),
});

export async function GET() {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  const seo = await getSiteSeo();
  const origin = siteOrigin();

  return NextResponse.json({
    ok: true,
    seo,
    defaults: siteSeoDefaults(),
    origin,
    publicPaths: SEO_PUBLIC_PATHS,
    robotsUrl: `${origin}/robots.txt`,
    sitemapUrl: `${origin}/sitemap.xml`,
  });
}

export async function POST(request: Request) {
  const auth = await requirePlatformStaff();
  if (!auth.ok) return auth.response;

  try {
    const body = patchSchema.parse(await request.json());
    const seo = await saveSiteSeo(body);
    return NextResponse.json({ ok: true, seo });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not save SEO settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
