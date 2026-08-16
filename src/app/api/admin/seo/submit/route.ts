import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { siteOrigin } from "@/lib/site-seo-server";

export const dynamic = "force-dynamic";

type PingResult = { engine: string; ok: boolean; detail: string };

async function ping(engine: string, url: string): Promise<PingResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { "User-Agent": "TheTrainStationSEO/1.0" },
    });
    return {
      engine,
      ok: res.ok || res.status === 200 || res.status === 204,
      detail: `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      engine,
      ok: false,
      detail: e instanceof Error ? e.message : "request failed",
    };
  }
}

/** Ask Google and Bing to recrawl the public sitemap. */
export async function POST() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;

  const origin = siteOrigin();
  const sitemap = `${origin}/sitemap.xml`;

  const results = await Promise.all([
    ping("Google", `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`),
    ping("Bing", `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`),
  ]);

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    sitemap,
    results,
    note: "Pings ask engines to recrawl. Safari on iPhone uses Google. It will not rank for generic “train station” (railroad / maps) — branded searches like “The Train Station coaching” and thetrainstation.co will.",
  });
}
