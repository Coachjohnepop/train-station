#!/usr/bin/env node
/**
 * Put a working product photo on every Gear item.
 *
 * 1) Items that already have productUrl → resolve best image (a.co redirects, ASIN MAIN, og:image)
 * 2) Standard home gear without a product link → attach a curated Amazon product + photo
 *    so they appear on member Gear (shop requires productUrl + imageUrl).
 *
 *   npx tsx scripts/backfill-equipment-images-prod.mjs --dry-run
 *   npx tsx scripts/backfill-equipment-images-prod.mjs
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.live.check", override: true });
dotenv.config({ path: ".env.vercel.production", override: true });

const dryRun = process.argv.includes("--dry-run");

/** Curated Amazon product pages for home checklist names (case-insensitive match). */
const CURATED_PRODUCTS = [
  {
    match: [/^yoga mat$/i, /exercise yoga mat/i, /amazon basics.*yoga mat/i],
    name: "Yoga mat",
    productUrl:
      "https://www.amazon.com/AmazonBasics-Extra-Thick-Exercise-Carrying/dp/B01LP0U5X0",
    category: "accessory",
  },
  {
    match: [/^dumbbells \(pair\)$/i, /^dumbbells set/i, /dumbbells set 5/i],
    name: null, // keep existing name when updating product/image only
    productUrl: "https://www.amazon.com/dp/B0B4V1MV4N",
    category: "dumbbells",
  },
  {
    match: [/^adjustable dumbbells$/i],
    name: "Adjustable Dumbbells",
    productUrl:
      "https://www.amazon.com/Yes4All-Adjustable-Dumbbells-Anti-Roll-Connectable/dp/B00AKZ6QPP",
    category: "dumbbells",
  },
  {
    match: [/^resistance bands$/i, /resistance bands with handles/i],
    name: "Resistance bands",
    productUrl:
      "https://www.amazon.com/Resistance-Bands-Handles-Exercise-Training/dp/B07Y58W93H",
    category: "bands",
  },
  {
    match: [/^pull-?up bar/i, /doorway bar/i],
    name: "Pull-up bar",
    productUrl: "https://www.amazon.com/Iron-Gym-Total-Upper-Body/dp/B001EJMS6K",
    category: "pullup",
  },
  {
    match: [/^kettlebell$/i],
    name: "Kettlebell",
    productUrl: "https://www.amazon.com/Yes4All-Kettlebell-Weights-Strength-Training/dp/B00U5U4AQG",
    category: "kettlebell",
  },
  {
    match: [/^stability ball$/i, /swiss/i],
    name: "Stability ball",
    productUrl: "https://www.amazon.com/Trideer-Exercise-Anti-Burst-Stability-Supports/dp/B07D28H41F",
    category: "accessory",
  },
  {
    match: [/^foam roller$/i],
    name: "Foam roller",
    productUrl: "https://www.amazon.com/AmazonBasics-High-Density-Round-Foam-Roller/dp/B00XM2N3YC",
    category: "recovery",
  },
  {
    match: [/^jump rope$/i],
    name: "Jump rope",
    productUrl: "https://www.amazon.com/AmazonBasics-Jump-Rope-Black/dp/B071NLZ569",
    category: "cardio",
  },
  {
    match: [/^medicine ball$/i],
    name: "Medicine ball",
    productUrl: "https://www.amazon.com/Yes4All-Medicine-Ball-lbs-Soft/dp/B00B5LX9SM",
    category: "accessory",
  },
  {
    match: [/^bench/i, /sturdy chair/i],
    name: "Bench or sturdy chair",
    productUrl: "https://www.amazon.com/Adjustable-Weight-Bench-Strength-Training/dp/B08GCLV6Y8",
    category: "bench",
  },
  {
    match: [/^bosu/i],
    name: "Bosu Ball Advanced",
    productUrl: "https://www.amazon.com/dp/B00BL83I22",
    category: "accessory",
  },
  {
    match: [/^kip bar$/i],
    name: "Kip Bar",
    productUrl: "https://www.amazon.com/Pull-Up-Bar-Station-Power-Tower/dp/B07D3BH6R8",
    category: "pullup",
  },
];

const SKIP_NAMES = [/^bodyweight/i];

function extractAmazonAsin(url) {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (!/amazon\.|amzn\.|a\.co/i.test(u.hostname)) {
      // still try path on non-amazon? no
    }
    const pathMatch = u.pathname.match(
      /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i,
    );
    if (pathMatch?.[1]) return pathMatch[1].toUpperCase();
    const queryAsin = u.searchParams.get("ASIN") || u.searchParams.get("asin");
    if (queryAsin && /^[A-Z0-9]{10}$/i.test(queryAsin)) return queryAsin.toUpperCase();
  } catch {
    /* fall through */
  }
  const m = String(url).match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m?.[1]?.toUpperCase() || null;
}

function amazonImageCandidates(asin) {
  const a = asin.toUpperCase();
  return [
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.MAIN._SCRMZZZZZZ_.jpg`,
    `https://m.media-amazon.com/images/I/${a}._AC_SL500_.jpg`,
    `https://m.media-amazon.com/images/P/${a}.01.MAIN._AC_SL500_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.LZZZZZZZ.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${a}.01.MAIN.jpg`,
  ];
}

function metaContent(html, keys) {
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
          .trim();
      }
    }
  }
  return null;
}

async function fetchBytes(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs || 12_000);
  try {
    const host = new URL(url).hostname;
    const isAmazon = /amazon|media-amazon|a\.co|amzn/i.test(host);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: opts.accept || "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(isAmazon && opts.asImage !== false ? { Referer: "https://www.amazon.com/" } : {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveProductPage(productUrl) {
  const out = {
    finalUrl: productUrl,
    asin: extractAmazonAsin(productUrl),
    ogImage: null,
  };
  try {
    const res = await fetchBytes(productUrl, {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      asImage: false,
      timeoutMs: 15_000,
    });
    if (res.url) {
      out.finalUrl = res.url;
      out.asin = extractAmazonAsin(res.url) || out.asin;
    }
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("text/html")) {
      const html = (await res.text()).slice(0, 400_000);
      const og = metaContent(html, ["og:image", "og:image:secure_url", "twitter:image"]);
      if (og) {
        try {
          out.ogImage = new URL(og, out.finalUrl).toString();
        } catch {
          out.ogImage = og;
        }
      }
      // Amazon sometimes embeds ASIN in data attributes when URL is messy
      if (!out.asin) {
        const m = html.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/i);
        if (m) out.asin = m[1].toUpperCase();
      }
    }
  } catch {
    /* keep partial */
  }
  return out;
}

async function firstWorkingImage(candidates) {
  let best = null;
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      const res = await fetchBytes(candidate.trim());
      if (!res.ok) continue;
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (
        contentType &&
        !contentType.startsWith("image/") &&
        !contentType.includes("octet-stream")
      ) {
        continue;
      }
      const body = await res.arrayBuffer();
      if (body.byteLength < 800) continue; // skip tiny placeholders
      if (body.byteLength > 2_500_000) continue;
      // Prefer larger images (more likely real product photo)
      if (!best || body.byteLength > best.bytes) {
        best = { url: candidate.trim(), bytes: body.byteLength };
      }
      // Good enough MAIN tile
      if (body.byteLength > 20_000) return best.url;
    } catch {
      /* next */
    }
  }
  return best?.url || null;
}

async function resolveImageForProduct(productUrl, existingImageUrl) {
  const page = await resolveProductPage(productUrl);
  const candidates = [];
  const push = (u) => {
    if (u?.trim() && !candidates.includes(u.trim())) candidates.push(u.trim());
  };

  // Prefer existing if it already works well — still try better candidates
  if (existingImageUrl) push(existingImageUrl);
  if (page.ogImage) push(page.ogImage);
  if (page.asin) {
    for (const c of amazonImageCandidates(page.asin)) push(c);
  }
  // ASIN from stored image path
  const fromStored = existingImageUrl?.match(/\/images\/P\/([A-Z0-9]{10})/i);
  if (fromStored?.[1]) {
    for (const c of amazonImageCandidates(fromStored[1])) push(c);
  }

  const imageUrl = await firstWorkingImage(candidates);
  return {
    imageUrl,
    productUrl: page.finalUrl || productUrl,
    asin: page.asin,
  };
}

function curatedForName(name) {
  const n = name.trim();
  if (SKIP_NAMES.some((re) => re.test(n))) return null;
  for (const c of CURATED_PRODUCTS) {
    if (c.match.some((re) => re.test(n))) return c;
  }
  return null;
}

async function main() {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client.ts");
  const { createPgPool } = await import("../src/lib/pg-connection.ts");

  const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";
  if (!connectionString || connectionString.includes("dummy")) {
    console.error("Need real DATABASE_URL / POSTGRES_PRISMA_URL");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(connectionString)),
  });

  const rows = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  console.log(`Catalog: ${rows.length} items  dryRun=${dryRun}\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Deduplicate: if two names map to same curated product, only first gets the link
  // (prefer rows that already have productUrl)
  const ordered = [...rows].sort((a, b) => {
    const ap = a.productUrl?.trim() ? 0 : 1;
    const bp = b.productUrl?.trim() ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });

  const usedProductKeys = new Set();

  for (const row of ordered) {
    let productUrl = row.productUrl?.trim() || null;
    const curated = curatedForName(row.name);

    if (!productUrl && curated) {
      const key = curated.productUrl;
      if (usedProductKeys.has(key)) {
        console.log(`• ${row.name} — skip (same product already assigned elsewhere)`);
        skipped += 1;
        continue;
      }
      productUrl = curated.productUrl;
    }

    if (!productUrl) {
      if (SKIP_NAMES.some((re) => re.test(row.name))) {
        console.log(`• ${row.name} — bodyweight (no shop product)`);
        skipped += 1;
        continue;
      }
      console.log(`• ${row.name} — no product link & no curated match`);
      skipped += 1;
      continue;
    }

    process.stdout.write(`• ${row.name} … `);
    try {
      const resolved = await resolveImageForProduct(productUrl, row.imageUrl);
      if (!resolved.imageUrl) {
        console.log("NO IMAGE");
        console.log(`    product=${productUrl}`);
        failed += 1;
        continue;
      }

      usedProductKeys.add(
        curated?.productUrl ||
          extractAmazonAsin(resolved.productUrl) ||
          resolved.productUrl,
      );

      const patch = {
        productUrl: resolved.productUrl,
        imageUrl: resolved.imageUrl,
      };
      // Clean ugly Amazon title names when we have a friendly curated name
      if (curated?.name && /amazon\.com\s*:/i.test(row.name)) {
        patch.name = curated.name;
      }

      const same =
        row.productUrl === patch.productUrl &&
        row.imageUrl === patch.imageUrl &&
        (!patch.name || patch.name === row.name);

      if (same) {
        console.log("ok");
        skipped += 1;
        continue;
      }

      console.log(dryRun ? "WOULD UPDATE" : "UPDATED");
      console.log(`    product: ${patch.productUrl}`);
      console.log(`    image:   ${patch.imageUrl}`);
      if (patch.name) console.log(`    name:    ${patch.name}`);

      if (!dryRun) {
        await prisma.equipment.update({
          where: { id: row.id },
          data: patch,
        });
      }
      updated += 1;
    } catch (err) {
      console.log("ERROR", err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  // Re-list shop-eligible
  const after = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  const shop = after.filter((r) => r.productUrl?.trim() && r.imageUrl?.trim());
  console.log("\n--- Gear shop eligible (product + image) ---");
  for (const s of shop) {
    console.log(`  ✓ ${s.name}`);
  }
  console.log("\n--- summary ---", { dryRun, updated, skipped, failed, shopCount: shop.length });

  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
