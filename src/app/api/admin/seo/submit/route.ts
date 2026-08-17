import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { siteOrigin } from "@/lib/site-seo-server";
import { getSiteSeo, saveSiteSeo } from "@/lib/site-seo-store";

export const dynamic = "force-dynamic";

/** One recrawl ping per calendar day is enough. More looks like spam. */
const RECRAWL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

  const seo = await getSiteSeo();
  const last = seo.lastRecrawlPingAt ? new Date(seo.lastRecrawlPingAt).getTime() : 0;
  const elapsed = Date.now() - last;
  if (last && elapsed < RECRAWL_COOLDOWN_MS) {
    const hoursLeft = Math.ceil((RECRAWL_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
    return NextResponse.json(
      {
        ok: false,
        error: `Already pinged in the last day. Wait about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} — daily pings do not help rank.`,
        lastRecrawlPingAt: seo.lastRecrawlPingAt,
        cooldownHours: 24,
      },
      { status: 429 },
    );
  }

  const origin = siteOrigin();
  const sitemap = `${origin}/sitemap.xml`;

  const results = await Promise.all([
    ping("Google", `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`),
    ping("Bing", `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`),
  ]);

  const next = await saveSiteSeo({ lastRecrawlPingAt: new Date().toISOString() });

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    sitemap,
    results,
    lastRecrawlPingAt: next.lastRecrawlPingAt,
    note: "Asked once. Recrawl is hours–days. Do not ping again today. Safari uses Google. We rank for “The Train Station fitness” — never generic “train station.”",
  });
}
