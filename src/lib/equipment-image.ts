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
 * Prefer `.01.MAIN…` paths — the old `.01._SCLZZZZZZZ_` and ads-widget
 * URLs often return a 43-byte placeholder GIF or fail DNS.
 */
export function amazonImageCandidates(asin: string): string[] {
  const a = asin.toUpperCase();
  return [
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.MAIN._SCRMZZZZZZ_.jpg`,
    `https://m.media-amazon.com/images/P/${a}.01.MAIN._AC_SL500_.jpg`,
    `https://m.media-amazon.com/images/P/${a}._AC_SL500_.jpg`,
    `https://images.amazon.com/images/P/${a}.01.LZZZZZZZ.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.MAIN.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.LZZZZZZZ.jpg`,
  ];
}

/** True when a stored imageUrl is a known-broken Amazon pattern we should skip. */
export function isLikelyBrokenAmazonImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("amazon-adsystem.com") ||
    u.includes("._sclzzzzzzz_") ||
    u.includes(".01._sclzzzzzzz_")
  );
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

  // Skip known-dead Amazon tile URLs so ASIN MAIN patterns can win.
  if (imageUrl?.trim() && !isLikelyBrokenAmazonImageUrl(imageUrl)) {
    push(imageUrl);
  }

  const asinFromImage = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const m = url.match(/\/images\/P\/([A-Z0-9]{10})/i);
    if (m?.[1]) return m[1].toUpperCase();
    return extractAmazonAsin(url);
  };

  const asin =
    (productUrl ? extractAmazonAsin(productUrl) : null) || asinFromImage(imageUrl);
  if (asin) {
    for (const c of amazonImageCandidates(asin)) push(c);
  }
  // Last resort: try stored URL even if it looked broken
  if (imageUrl?.trim() && isLikelyBrokenAmazonImageUrl(imageUrl)) {
    push(imageUrl);
  }
  return out;
}

/**
 * Resolve a real, fetchable product photo (or null if none work).
 * Used before publishing equipment to Gear.
 */
export async function resolveWorkingEquipmentImage(
  imageUrl: string | null | undefined,
  productUrl: string | null | undefined,
): Promise<{ imageUrl: string; sourceUrl: string } | null> {
  const candidates = resolveEquipmentImageCandidates(imageUrl, productUrl);
  if (candidates.length === 0) return null;
  const image = await fetchFirstWorkingImage(candidates, {
    strictHostAllowlist: false,
  });
  if (!image) return null;
  return { imageUrl: image.sourceUrl, sourceUrl: image.sourceUrl };
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
      // Amazon serves a ~43-byte placeholder GIF when the ASIN path is wrong
      if (body.byteLength < 500) continue;
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
