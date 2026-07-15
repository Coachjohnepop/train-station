import "server-only";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

function absoluteUrl(base: string, maybeRelative: string | null | undefined): string | null {
  if (!maybeRelative?.trim()) return null;
  const raw = maybeRelative.trim();
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) {
        return m[1]
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
      }
    }
  }
  return null;
}

function titleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

/** Best-effort Amazon ASIN from product URLs. */
export function extractAmazonAsin(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/amazon\./i.test(u.hostname)) return null;
    const pathMatch = u.pathname.match(
      /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i,
    );
    if (pathMatch?.[1]) return pathMatch[1].toUpperCase();
    const queryAsin = u.searchParams.get("ASIN") || u.searchParams.get("asin");
    if (queryAsin && /^[A-Z0-9]{10}$/i.test(queryAsin)) return queryAsin.toUpperCase();
  } catch {
    /* ignore */
  }
  return null;
}

function amazonImageFallback(asin: string): string {
  // Public product image pattern — works for many ASINs without scraping.
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX500_.jpg`;
}

function cleanProductTitle(title: string | null, host: string): string | null {
  if (!title) return null;
  let t = title.replace(/\s+/g, " ").trim();
  // Strip common Amazon suffix noise
  t = t.replace(/\s*[|:–-]\s*Amazon\.(com|ca|co\.uk).*$/i, "").trim();
  t = t.replace(/\s+at\s+Amazon\.com.*$/i, "").trim();
  if (!t || t.toLowerCase() === host.toLowerCase()) return null;
  // Cap long marketplace titles
  if (t.length > 160) t = `${t.slice(0, 157)}…`;
  return t;
}

/**
 * Fetch a product/page URL and extract title + image for equipment cards.
 * Marketplace sites may block bots — falls back to Amazon ASIN image when possible.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid http(s) product link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Link must start with http:// or https://");
  }

  const asin = extractAmazonAsin(url.toString());
  let title: string | null = null;
  let description: string | null = null;
  let imageUrl: string | null = asin ? amazonImageFallback(asin) : null;
  let siteName: string | null = url.hostname.replace(/^www\./, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("text/html")) {
      const html = (await res.text()).slice(0, 400_000);
      const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
      const ogImage = metaContent(html, ["og:image", "og:image:secure_url", "twitter:image"]);
      const ogDesc = metaContent(html, ["og:description", "description", "twitter:description"]);
      const ogSite = metaContent(html, ["og:site_name"]);

      title = cleanProductTitle(ogTitle || titleFromHtml(html), siteName);
      description = ogDesc?.slice(0, 500) || null;
      siteName = ogSite || siteName;
      const absImage = absoluteUrl(url.toString(), ogImage);
      if (absImage) imageUrl = absImage;
    }
  } catch {
    // Keep ASIN / empty fallbacks — coach can still edit name after paste.
  }

  if (!title && asin) {
    title = `Amazon product ${asin}`;
  }
  if (!title) {
    title = siteName ? `Equipment from ${siteName}` : "Equipment";
  }

  return {
    url: url.toString(),
    title,
    description,
    imageUrl,
    siteName,
  };
}
