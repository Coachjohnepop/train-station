#!/usr/bin/env node
/**
 * Merge duplicate workout names — keep one canonical workout per title, reassign refs, delete rest.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/dedupe-workout-names.mjs
 *   npx tsx scripts/dedupe-workout-names.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { workoutContentTitle } from "../src/lib/workout-content-name.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function normalizeKey(name) {
  return workoutContentTitle(name).trim().toLowerCase();
}

async function countRefs(prisma, workoutId) {
  const [options, days, cycleSlots, logs] = await Promise.all([
    prisma.programDayOption.count({ where: { workoutId } }),
    prisma.programDay.count({ where: { workoutId } }),
    prisma.workoutCycleDaySlot.count({ where: { workoutId } }),
    prisma.workoutLog.count({ where: { workoutId } }),
  ]);
  return options + days + cycleSlots + logs;
}

async function pickKeeper(workouts, prisma) {
  const scored = await Promise.all(
    workouts.map(async (w) => ({
      w,
      refs: await countRefs(prisma, w.id),
    })),
  );
  scored.sort((a, b) => {
    const exA = a.w._count.exercises;
    const exB = b.w._count.exercises;
    if (exB !== exA) return exB - exA;
    if (b.refs !== a.refs) return b.refs - a.refs;
    return new Date(a.w.createdAt).getTime() - new Date(b.w.createdAt).getTime();
  });
  return scored[0].w;
}

async function reassignWorkoutId(prisma, fromId, toId) {
  await prisma.programDayOption.updateMany({
    where: { workoutId: fromId },
    data: { workoutId: toId },
  });
  await prisma.programDay.updateMany({
    where: { workoutId: fromId },
    data: { workoutId: toId },
  });
  await prisma.workoutLog.updateMany({
    where: { workoutId: fromId },
    data: { workoutId: toId },
  });

  const slots = await prisma.workoutCycleDaySlot.findMany({
    where: { workoutId: fromId },
  });
  for (const slot of slots) {
    const existing = await prisma.workoutCycleDaySlot.findUnique({
      where: {
        cycleDayId_trainingLocation: {
          cycleDayId: slot.cycleDayId,
          trainingLocation: slot.trainingLocation,
        },
      },
    });
    if (existing && existing.id !== slot.id) {
      if (existing.workoutId === toId) {
        await prisma.workoutCycleDaySlot.delete({ where: { id: slot.id } });
      } else if (existing.workoutId === fromId) {
        await prisma.workoutCycleDaySlot.update({
          where: { id: existing.id },
          data: { workoutId: toId },
        });
        await prisma.workoutCycleDaySlot.delete({ where: { id: slot.id } });
      } else {
        await prisma.workoutCycleDaySlot.update({
          where: { id: slot.id },
          data: { workoutId: toId },
        });
      }
    } else {
      await prisma.workoutCycleDaySlot.update({
        where: { id: slot.id },
        data: { workoutId: toId },
      });
    }
  }
}

async function main() {
  const pool = createPgPool(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const workouts = await prisma.workout.findMany({
    include: { _count: { select: { exercises: true } } },
    orderBy: { name: "asc" },
  });

  const groups = new Map();
  for (const w of workouts) {
    const key = normalizeKey(w.name);
    if (!key || key === "workout") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }

  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Found ${dupGroups.length} duplicate title groups (of ${workouts.length} workouts)\n`);

  let deleted = 0;
  let renamed = 0;

  for (const [key, list] of dupGroups.sort((a, b) => b[1].length - a[1].length)) {
    const keeper = await pickKeeper(list, prisma);
    const canonicalName = workoutContentTitle(keeper.name);
    const dupes = list.filter((w) => w.id !== keeper.id);

    console.log(`“${canonicalName}” — keep ${keeper.id} (${keeper._count.exercises} ex), merge ${dupes.length}:`);
    for (const d of dupes) {
      console.log(`  · delete ${d.id} (${d._count.exercises} ex) was “${d.name}”`);
    }

    if (DRY_RUN) continue;

    for (const dupe of dupes) {
      await reassignWorkoutId(prisma, dupe.id, keeper.id);
      await prisma.workout.delete({ where: { id: dupe.id } });
      deleted += 1;
    }

    if (keeper.name !== canonicalName) {
      await prisma.workout.update({
        where: { id: keeper.id },
        data: { name: canonicalName },
      });
      renamed += 1;
    }
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
  } else {
    const remaining = await prisma.workout.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const keys = remaining.map((w) => normalizeKey(w.name));
    const dupeKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
    console.log(`\nDeleted ${deleted} duplicate workouts. Normalized ${renamed} keeper names.`);
    console.log(`Remaining duplicate keys: ${new Set(dupeKeys).size}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});