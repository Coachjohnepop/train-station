#!/usr/bin/env node
/**
 * Ensure production has a full home-equipment checklist (~10 standard items).
 * Merges by name (case-insensitive) — does not delete shop/custom rows.
 *
 *   DATABASE_URL=… npx tsx scripts/seed-home-equipment-catalog-prod.mjs
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { readFileSync } from "fs";
import { join } from "path";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  "";
if (!connectionString || connectionString.includes("dummy")) {
  console.error("Need real DATABASE_URL");
  process.exit(1);
}

const adapter = new PrismaPg(createPgPool(connectionString));
const prisma = new PrismaClient({ adapter });

/** Canonical home checklist — names match seed-data + a few common extras. */
const HOME_DEFAULTS = [
  { id: "eq-bodyweightonly", name: "Bodyweight only", category: "bodyweight", description: "No gear needed" },
  { id: "eq-dumbbellspair", name: "Dumbbells (pair)", category: "dumbbells", description: "Any pair / adjustable" },
  { id: "eq-resistancebands", name: "Resistance bands", category: "bands", description: "Loop or tube bands" },
  { id: "eq-pullupbar", name: "Pull-up bar", category: "pullup", description: "Doorway or free-standing" },
  { id: "eq-bench", name: "Bench or sturdy chair", category: "bench", description: "For presses / step-ups" },
  { id: "eq-kettlebell", name: "Kettlebell", category: "kettlebell", description: null },
  { id: "eq-stability-ball", name: "Stability ball", category: "accessory", description: "Swiss / yoga ball" },
  { id: "eq-yoga-mat", name: "Yoga mat", category: "accessory", description: "Floor work" },
  { id: "eq-jump-rope", name: "Jump rope", category: "cardio", description: null },
  { id: "eq-foam-roller", name: "Foam roller", category: "recovery", description: null },
  { id: "eq-medicine-ball", name: "Medicine ball", category: "accessory", description: null },
];

function loadSeedEquipment() {
  try {
    const seed = JSON.parse(
      readFileSync(join(process.cwd(), "prisma", "seed-data.json"), "utf8"),
    );
    return Array.isArray(seed.equipment) ? seed.equipment : [];
  } catch {
    return [];
  }
}

async function main() {
  const existing = await prisma.equipment.findMany({
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));
  const byId = new Map(existing.map((e) => [e.id, e]));

  const fromSeed = loadSeedEquipment().map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category || null,
    description: e.description || null,
  }));

  // Prefer explicit HOME_DEFAULTS, then any seed rows not already covered by name
  const wanted = [...HOME_DEFAULTS];
  for (const s of fromSeed) {
    if (!wanted.some((w) => w.name.toLowerCase() === s.name.toLowerCase())) {
      wanted.push({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
      });
    }
  }

  let created = 0;
  let skipped = 0;
  for (const item of wanted) {
    const key = item.name.trim().toLowerCase();
    if (byName.has(key) || byId.has(item.id)) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.equipment.create({
        data: {
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description,
          productUrl: null,
          imageUrl: null,
        },
      });
      created += 1;
      console.log("created", item.name);
    } catch (e) {
      // id collision with different name — create without fixed id
      try {
        await prisma.equipment.create({
          data: {
            name: item.name,
            category: item.category,
            description: item.description,
            productUrl: null,
            imageUrl: null,
          },
        });
        created += 1;
        console.log("created (new id)", item.name);
      } catch (e2) {
        console.warn("skip", item.name, e2.message || e.message);
      }
    }
  }

  const after = await prisma.equipment.findMany({
    orderBy: { name: "asc" },
    select: { name: true, category: true },
  });
  console.log(JSON.stringify({ created, skipped, total: after.length, items: after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
