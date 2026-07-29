#!/usr/bin/env node
/**
 * Apply product links + working photos so items show on member Gear shop.
 *
 *   npx tsx scripts/apply-equipment-gear-images-prod.mjs
 *   npx tsx scripts/apply-equipment-gear-images-prod.mjs --dry-run
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.live.check", override: true });
dotenv.config({ path: ".env.vercel.production", override: true });

const dryRun = process.argv.includes("--dry-run");
const SITE = "https://www.thetrainstation.co";

function amazonMain(asin) {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
}
function amazonDp(asin) {
  return `https://www.amazon.com/dp/${asin}`;
}

/**
 * Map catalog row name → product + image.
 * Prefer verified Amazon MAIN tiles; hosted site/stock for the rest.
 * Only primary shop rows get links (duplicates stay home-checklist only).
 */
const UPDATES_BY_NAME = [
  {
    // Prefer the long Amazon-title row so we can rename it; also covers plain "Yoga mat"
    match: /yoga mat/i,
    name: "Yoga mat",
    productUrl: amazonDp("B01LP0U5X0"),
    imageUrl: amazonMain("B01LP0U5X0"),
    category: "accessory",
    description: "Extra-thick exercise mat for floor work",
    preferLongestName: true,
  },
  {
    match: /^bosu/i,
    name: "Bosu Ball Advanced",
    productUrl: amazonDp("B00BL83I22"),
    imageUrl: amazonMain("B00BL83I22"),
    category: "accessory",
  },
  {
    match: /dumbbells set 5/i,
    name: "Dumbbells set 5lbs to 30lbs",
    productUrl: amazonDp("B0B4V1MV4N"),
    imageUrl: amazonMain("B0B4V1MV4N"),
    category: "dumbbells",
  },
  {
    match: /^adjustable dumbbells$/i,
    name: "Adjustable Dumbbells",
    productUrl: amazonDp("B08BDD6GPC"),
    imageUrl: amazonMain("B08BDD6GPC"),
    category: "dumbbells",
  },
  {
    match: /^dumbbells \(pair\)$/i,
    name: "Dumbbells (pair)",
    productUrl: amazonDp("B0B4V1MV4N"),
    imageUrl: amazonMain("B0B4V1MV4N"),
    category: "dumbbells",
    description: "Any pair / adjustable",
  },
  {
    match: /^resistance bands$/i,
    name: "Resistance bands",
    productUrl: amazonDp("B0GQLX31JP"),
    imageUrl: "https://m.media-amazon.com/images/I/71bzimircJL._AC_SL1500_.jpg",
    category: "bands",
  },
  {
    match: /^resistance bands with handles$/i,
    // same product as bands — keep shoppable with photo
    name: "Resistance Bands with Handles",
    productUrl: amazonDp("B0GQLX31JP"),
    imageUrl: "https://m.media-amazon.com/images/I/71bzimircJL._AC_SL1500_.jpg",
    category: "bands",
  },
  {
    match: /^pull-?up bar$/i,
    name: "Pull-up bar",
    productUrl: amazonDp("B001EJMS6K"),
    imageUrl: amazonMain("B001EJMS6K"),
    category: "pullup",
  },
  {
    match: /doorway bar/i,
    name: "Pull-up Bar / Doorway Bar",
    productUrl: amazonDp("B001EJMS6K"),
    imageUrl: amazonMain("B001EJMS6K"),
    category: "pullup",
  },
  {
    match: /^kettlebell$/i,
    name: "Kettlebell",
    productUrl: amazonDp("B07F1RGQTR"),
    imageUrl: amazonMain("B07F1RGQTR"),
    category: "kettlebell",
  },
  {
    match: /^stability ball$/i,
    name: "Stability ball",
    productUrl: amazonDp("B07RX2J294"),
    imageUrl: amazonMain("B07RX2J294"),
    category: "accessory",
  },
  {
    match: /^foam roller$/i,
    name: "Foam roller",
    productUrl: amazonDp("B00XM2MXK8"),
    imageUrl: amazonMain("B00XM2MXK8"),
    category: "recovery",
  },
  {
    match: /^medicine ball$/i,
    name: "Medicine ball",
    productUrl: amazonDp("B000KYQ70I"),
    imageUrl: amazonMain("B000KYQ70I"),
    category: "accessory",
  },
  {
    match: /^bench$/i,
    name: "Bench",
    productUrl: amazonDp("B08GCLV6Y8"),
    imageUrl: amazonMain("B08GCLV6Y8"),
    category: "bench",
  },
  {
    match: /sturdy chair/i,
    name: "Bench or sturdy chair",
    productUrl: amazonDp("B08GCLV6Y8"),
    imageUrl: amazonMain("B08GCLV6Y8"),
    category: "bench",
  },
  {
    match: /^jump rope$/i,
    name: "Jump rope",
    productUrl: "https://www.amazon.com/s?k=jump+rope+fitness",
    // Self-hosted after deploy; Unsplash works immediately via allowlist
    imageUrl: `${SITE}/images/equipment/jump-rope.jpg`,
    category: "cardio",
  },
  {
    match: /^kip bar$/i,
    name: "Kip Bar",
    productUrl: "https://www.amazon.com/s?k=pull+up+station+power+tower",
    imageUrl: `${SITE}/images/equipment/power-tower.jpg`,
    category: "pullup",
  },
];

async function verifyImage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*,*/*",
        Referer: "https://www.amazon.com/",
      },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    return buf.byteLength >= 800;
  } catch {
    return false;
  }
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
    console.error("Need real DATABASE_URL");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(connectionString)),
  });

  const rows = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  console.log(`Catalog ${rows.length}  dryRun=${dryRun}\n`);

  let updated = 0;
  let failed = 0;
  const claimed = new Set(); // update rule ids used

  for (const rule of UPDATES_BY_NAME) {
    const matches = rows.filter((r) => rule.match.test(r.name) && !claimed.has(r.id));
    if (matches.length === 0) {
      console.log(`(no row) ${rule.name}`);
      continue;
    }
    // Prefer a row already named the clean target; else shortest name
    const exact = matches.find(
      (r) => r.name.trim().toLowerCase() === rule.name.trim().toLowerCase(),
    );
    matches.sort((a, b) => a.name.length - b.name.length);
    const row = exact || matches[0];
    claimed.add(row.id);

    // Jump rope / kip bar: if site image not live yet, fall back to Unsplash CDN
    let imageUrl = rule.imageUrl;
    if (!(await verifyImage(imageUrl))) {
      const fallbacks = {
        "Jump rope":
          "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80",
        "Kip Bar":
          "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?w=800&q=80",
      };
      if (fallbacks[rule.name] && (await verifyImage(fallbacks[rule.name]))) {
        imageUrl = fallbacks[rule.name];
        console.log(`  fallback image for ${rule.name}`);
      } else {
        console.log(`✗ ${row.name} — image not reachable: ${imageUrl}`);
        failed += 1;
        continue;
      }
    }

    // Only rename when target name is free (unique constraint on Equipment.name)
    const nameTakenByOther = rows.some(
      (r) =>
        r.id !== row.id &&
        r.name.trim().toLowerCase() === rule.name.trim().toLowerCase(),
    );
    const nextName = nameTakenByOther ? row.name : rule.name;

    const data = {
      name: nextName,
      productUrl: rule.productUrl,
      imageUrl,
      category: rule.category ?? row.category,
      description:
        rule.description !== undefined ? rule.description : row.description,
    };

    console.log(`✓ ${row.name} → ${data.name}`);
    console.log(`    ${data.productUrl}`);
    console.log(`    ${data.imageUrl}`);

    if (!dryRun) {
      await prisma.equipment.update({ where: { id: row.id }, data });
    }
    updated += 1;

    // Extra matches for same gear: strip shop fields so Gear isn't full of dupes
    for (const extra of matches.filter((m) => m.id !== row.id)) {
      claimed.add(extra.id);
      if (extra.productUrl || extra.imageUrl) {
        console.log(`  clear shop fields on duplicate: ${extra.name}`);
        if (!dryRun) {
          await prisma.equipment.update({
            where: { id: extra.id },
            data: { productUrl: null, imageUrl: null },
          });
        }
      }
    }
  }

  const after = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  const shop = after.filter((r) => r.productUrl?.trim() && r.imageUrl?.trim());
  console.log("\n--- Gear shop ---");
  for (const s of shop) console.log(`  • ${s.name}`);
  console.log({ dryRun, updated, failed, shopCount: shop.length });

  await prisma.$disconnect();
  if (failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
