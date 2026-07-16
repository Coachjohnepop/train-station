/**
 * Remove empty workout shells (0 exercises) that are safe to purge.
 *
 * Deletes:
 *  - Orphans (no program/cycle/log refs)
 *  - Soak markers (marshmallow-badger, clone-party, jerdog, builder-soak, …)
 *  - Generic empty "Workout" / "Rest Day" / "Fasted Cardio" only if not
 *    a Day-N catalog-style name
 *
 * Keeps:
 *  - Empty Day 3 / Day 28 Rest Day (Home) style catalog placeholders still linked
 *  - Anything with workout logs
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/cleanup-empty-workout-shells.mjs
 *   npx tsx scripts/cleanup-empty-workout-shells.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.vercel.production", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("Need real Postgres URL (.env.vercel.production)");
  }
  return url;
}

function isSoakName(name) {
  return /jerdog|builder-soak|clone-party|marshmallow-badger|laser-chicken|confetti-goose|testingsilly|s1d-\d+/i.test(
    name || "",
  );
}

/** Generic empty shells we created as defaults — not Day-N catalog titles. */
function isGenericEmptyShellName(name) {
  const n = (name || "").trim();
  if (!n) return true;
  if (/^workout$/i.test(n)) return true;
  if (/^rest day$/i.test(n)) return true;
  if (/^fasted cardio$/i.test(n)) return true;
  return false;
}

function isCatalogDayStyleName(name) {
  return /^day\s+\d+/i.test((name || "").trim());
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log(`\nEmpty workout shell cleanup${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const empties = await prisma.workout.findMany({
    where: { exercises: { none: {} } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          dayOptions: true,
          programDays: true,
          cycleSlots: true,
          logs: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const toDelete = [];
  const keep = [];

  for (const w of empties) {
    const refs =
      w._count.dayOptions +
      w._count.programDays +
      w._count.cycleSlots +
      w._count.logs;
    const orphan = refs === 0;
    const soak = isSoakName(w.name);
    const generic = isGenericEmptyShellName(w.name);
    const catalogDay = isCatalogDayStyleName(w.name);
    const hasLogs = w._count.logs > 0;

    // Never delete if members logged against it
    if (hasLogs) {
      keep.push({ w, reason: "has logs" });
      continue;
    }

    // Soak always goes (clear refs first)
    if (soak) {
      toDelete.push({ w, reason: "soak marker" });
      continue;
    }

    // Pure orphans
    if (orphan) {
      toDelete.push({ w, reason: "orphan empty" });
      continue;
    }

    // Generic empty "Workout" / "Rest Day" / "Fasted Cardio" with only cycle/option glue
    if (generic && !catalogDay) {
      toDelete.push({ w, reason: "generic empty shell" });
      continue;
    }

    keep.push({
      w,
      reason: `linked catalog-style (opts=${w._count.dayOptions} days=${w._count.programDays} cycle=${w._count.cycleSlots})`,
    });
  }

  console.log(`Empty total: ${empties.length}`);
  console.log(`Will delete: ${toDelete.length}`);
  console.log(`Will keep:   ${keep.length}\n`);

  for (const { w, reason } of toDelete) {
    console.log(
      `  DEL  [${reason}] ${w.name} (${w.id}) opts=${w._count.dayOptions} cycle=${w._count.cycleSlots}`,
    );
  }
  console.log();
  for (const { w, reason } of keep) {
    console.log(`  KEEP [${reason}] ${w.name}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes.\n");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const ids = toDelete.map((x) => x.w.id);
  if (!ids.length) {
    console.log("\nNothing to delete.\n");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const removedOptions = await prisma.programDayOption.deleteMany({
    where: { workoutId: { in: ids } },
  });
  const clearedDays = await prisma.programDay.updateMany({
    where: { workoutId: { in: ids } },
    data: { workoutId: null },
  });
  const removedCycle = await prisma.workoutCycleDaySlot.deleteMany({
    where: { workoutId: { in: ids } },
  });
  try {
    await prisma.workoutTemplate.deleteMany({ where: { workoutId: { in: ids } } });
  } catch {
    /* optional */
  }
  await prisma.workoutLog.deleteMany({ where: { workoutId: { in: ids } } });
  await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: ids } } });
  const deleted = await prisma.workout.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `\nCleared: ${removedOptions.count} options, ${clearedDays.count} days, ${removedCycle.count} cycle slots`,
  );
  console.log(`Deleted ${deleted.count} empty workout shell(s).\n`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
