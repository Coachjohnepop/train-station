import "server-only";

import { extractAmazonAsin } from "@/lib/link-preview";

/** Hosts we will fetch for equipment product photos (open proxy guard). */
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  "amazon.com",
  "amazon.ca",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.com.au",
  "amazon.co.jp",
  "ssl-images-amazon.com",
  "images-amazon.com",
  "media-amazon.com",
  "amazon-adsystem.com",
  "public.blob.vercel-storage.com",
  "blob.vercel-storage.com",
];

export function isAllowedEquipmentImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (/amazon\./i.test(host) || host.includes("media-amazon") || host.includes("amazon-adsystem")) {
    return true;
  }
  return ALLOWED_IMAGE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Candidate image URLs for an Amazon ASIN.
 * Old `images/P/{ASIN}.01…` patterns often 404; try several CDNs.
 */
export function amazonImageCandidates(asin: string): string[] {
  const a = asin.toUpperCase();
  return [
    // Ads widget — historically reliable for product tiles
    `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&MarketPlace=US&ASIN=${a}&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=_SL300_`,
    `https://m.media-amazon.com/images/P/${a}.01._SCLZZZZZZZ_SX300_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01._SCLZZZZZZZ_SX300_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.LZZZZZZZ.jpg`,
  ];
}

/** Ordered candidates: stored image first, then Amazon ASIN fallbacks. */
export function resolveEquipmentImageCandidates(
  imageUrl: string | null | undefined,
  productUrl: string | null | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | null | undefined) => {
    const t = u?.trim();
    if (!t || seen.has(t)) return;
    try {
      const parsed = new URL(t);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      seen.add(t);
      out.push(t);
    } catch {
      /* skip */
    }
  };

  push(imageUrl);
  const asin = productUrl ? extractAmazonAsin(productUrl) : null;
  if (asin) {
    for (const c of amazonImageCandidates(asin)) push(c);
  }
  return out;
}

/**
 * Fetch first working image bytes from candidate URLs.
 * @param strictHostAllowlist when true (default for free-form ?url=), only known product CDNs.
 * Catalog items use false so any stored https imageUrl can load.
 */
export async function fetchFirstWorkingImage(
  candidates: string[],
  opts?: { strictHostAllowlist?: boolean },
): Promise<{ body: ArrayBuffer; contentType: string; sourceUrl: string } | null> {
  const strict = opts?.strictHostAllowlist === true;

  for (const candidate of candidates) {
    let host: string;
    try {
      host = new URL(candidate).hostname;
    } catch {
      continue;
    }
    if (strict && !isAllowedEquipmentImageHost(host)) continue;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const isAmazon = /amazon|media-amazon|amazon-adsystem/i.test(host);
      const res = await fetch(candidate, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          ...(isAmazon ? { Referer: "https://www.amazon.com/" } : {}),
        },
        cache: "force-cache",
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType && !contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
        continue;
      }
      const body = await res.arrayBuffer();
      if (body.byteLength < 200) continue; // tiny error GIF / empty
      // Cap proxy payload (~2.5MB)
      if (body.byteLength > 2_500_000) continue;
      return {
        body,
        contentType: contentType.startsWith("image/")
          ? contentType.split(";")[0]!.trim()
          : "image/jpeg",
        sourceUrl: candidate,
      };
    } catch {
      continue;
    }
  }
  return null;
}
