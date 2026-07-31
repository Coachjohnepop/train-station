import type { MetadataRoute } from "next";
import { getSiteSeo, SEO_PUBLIC_PATHS } from "@/lib/site-seo-store";
import { siteOrigin } from "@/lib/site-seo-server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSiteSeo();
  const origin = siteOrigin();

  // When indexing is off, return an empty sitemap (robots already disallow all).
  if (!seo.robotsIndex) {
    return [];
  }

  const lastModified = seo.updatedAt ? new Date(seo.updatedAt) : new Date();

  return SEO_PUBLIC_PATHS.map((entry) => ({
    url: `${origin}${entry.path === "/" ? "" : entry.path}`,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
