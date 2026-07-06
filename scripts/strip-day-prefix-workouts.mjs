#!/usr/bin/env node
/**
 * Strip "Day N" prefixes from workout names — day lives on ProgramDay, not Workout.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/strip-day-prefix-workouts.mjs
 *   node scripts/strip-day-prefix-workouts.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { workoutContentTitle } from "../src/lib/workout-content-name.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("DATABASE_URL must be a real Postgres URL (.env.go-prod)");
  }
  return url;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const workouts = await prisma.workout.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const updates = [];
  for (const w of workouts) {
    const next = workoutContentTitle(w.name);
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