#!/usr/bin/env node
/**
 * Strip "Day N" prefixes from workout names — day lives on ProgramDay, not Workout.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/strip-day-prefix-workouts.mjs
 *   node scripts/strip-day-prefix-workouts.mjs
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function stripDayPrefix(name) {
  let result = String(name || "").trim();
  if (!result) return result;
  result = result.replace(/^day\s+\d+\s*[-–—:·]\s*/i, "");
  result = result.replace(/^day\s+\d+\s+/i, "");
  result = result.replace(/\s+day\s+\d+\s*$/i, "");
  result = result.replace(/\bupper\s+day\s+\d+\b/gi, "Upper body");
  return result.replace(/\s{2,}/g, " ").trim();
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const workouts = await prisma.workout.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const updates = [];
  for (const w of workouts) {
    const next = stripDayPrefix(w.name);
    if (next && next !== w.name) {
      updates.push({ id: w.id, from: w.name, to: next });
    }
  }

  console.log(`Found ${updates.length} workouts to rename (of ${workouts.length} total)`);
  for (const u of updates.slice(0, 20)) {
    console.log(`  ${u.from} → ${u.to}`);
  }
  if (updates.length > 20) console.log(`  … and ${updates.length - 20} more`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  for (const u of updates) {
    await prisma.workout.update({
      where: { id: u.id },
      data: { name: u.to },
    });
    ok += 1;
  }
  console.log(`\nRenamed ${ok} workouts.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});