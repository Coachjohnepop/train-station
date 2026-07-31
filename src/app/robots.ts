import type { MetadataRoute } from "next";
import { getSiteSeo } from "@/lib/site-seo-store";
import { siteOrigin } from "@/lib/site-seo-server";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSiteSeo();
  const origin = siteOrigin();

  if (!seo.robotsIndex) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: origin,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/api",
        "/api/",
        "/member",
        "/member/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/setup-quick-auth",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
