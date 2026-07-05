/**
 * Delete QA / smoke / sprint-test workouts from Postgres (+ optional seed snapshot).
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/cleanup-junk-workouts.ts
 *   npx tsx scripts/cleanup-junk-workouts.ts
 *   CLEAN_SEED=1 npx tsx scripts/cleanup-junk-workouts.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection";
import { isJunkWorkoutName } from "../src/lib/programs";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
// Supabase / Vercel production vars must win over local dummy DATABASE_URL.
dotenv.config({ path: ".env.vercel.production", override: true });

const DRY_RUN = process.env.DRY_RUN === "1";
const CLEAN_SEED = process.env.CLEAN_SEED === "1";
const SEED_PATH = path.join(process.cwd(), "prisma", "seed-data.json");

/** Never delete certified production workouts even if name matches a pattern. */
const PROTECTED_WORKOUT_IDS = new Set([
  "cmr6okj25000004jlh7a4bdlu", // Lower Day
]);

function resolveDatabaseUrl(): string {
  const postgres =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  const url =
    postgres || (database && !database.includes("dummy") ? database : "");
  if (!url || url.includes("dummy")) {
    throw new Error(
      "DATABASE_URL must be set to a real Postgres URL (try: vercel env pull .env.vercel.production)",
    );
  }
  return url;
}

function cleanSeedSnapshot(workoutIds: Set<string>) {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Record<string, unknown>;
  const workouts = (seed.workouts as Array<{ id: string }>) || [];
  const before = workouts.length;

  seed.workouts = workouts.filter((w) => !workoutIds.has(w.id));

  if (Array.isArray(seed.workoutExercises)) {
    seed.workoutExercises = seed.workoutExercises.filter(
      (we: { workoutId?: string }) => !workoutIds.has(we.workoutId || ""),
    );
  }
  if (Array.isArray(seed.programDayOptions)) {
    seed.programDayOptions = seed.programDayOptions.map(
      (opt: { workoutId?: string | null }) =>
        opt.workoutId && workoutIds.has(opt.workoutId)
          ? { ...opt, workoutId: null }
          : opt,
    );
  }
  if (Array.isArray(seed.programDays)) {
    seed.programDays = seed.programDays.map((day: { workoutId?: string | null }) =>
      day.workoutId && workoutIds.has(day.workoutId)
        ? { ...day, workoutId: null }
        : day,
    );
  }

  const after = (seed.workouts as unknown[]).length;
  if (!DRY_RUN) {
    writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  }
  console.log(`✅ Seed snapshot — ${before} → ${after} workouts (${before - after} removed)`);
}

async function countWorkoutReferences(prisma: PrismaClient, workoutIds: string[]) {
  const [programDayOptions, programDays, workoutLogs] = await Promise.all([
    prisma.programDayOption.count({ where: { workoutId: { in: workoutIds } } }),
    prisma.programDay.count({ where: { workoutId: { in: workoutIds } } }),
    prisma.workoutLog.count({ where: { workoutId: { in: workoutIds } } }),
  ]);
  return { programDayOptions, programDays, workoutLogs };
}

async function clearWorkoutReferences(prisma: PrismaClient, workoutIds: string[]) {
  const removedOptions = await prisma.programDayOption.deleteMany({
    where: { workoutId: { in: workoutIds } },
  });
  const clearedDays = await prisma.programDay.updateMany({
    where: { workoutId: { in: workoutIds } },
    data: { workoutId: null },
  });
  const removedLogs = await prisma.workoutLog.deleteMany({
    where: { workoutId: { in: workoutIds } },
  });
  return {
    programDayOptions: removedOptions.count,
    programDays: clearedDays.count,
    workoutLogs: removedLogs.count,
  };
}

async function main() {
  console.log(`\nJunk workout cleanup${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const connectionString = resolveDatabaseUrl();
  const pool = createPgPool(connectionString);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const workouts = await prisma.workout.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const junk = workouts.filter(
      (w) => isJunkWorkoutName(w.name) && !PROTECTED_WORKOUT_IDS.has(w.id),
    );

    console.log(`Found ${junk.length} junk workout(s) of ${workouts.length} total:\n`);
    for (const w of junk) {
      console.log(`  • ${w.name} (${w.id})`);
    }
    console.log();

    if (junk.length === 0) {
      console.log("✅ Nothing to delete\n");
      return;
    }

    const ids = junk.map((w) => w.id);

    if (DRY_RUN) {
      const refs = await countWorkoutReferences(prisma, ids);
      console.log(
        `References: ${refs.programDayOptions} day options, ${refs.programDays} program days, ${refs.workoutLogs} logs`,
      );
      for (const w of junk) {
        console.log(`✅ Would delete — ${w.name}`);
      }
      console.log(`\n${junk.length}/${junk.length} would be removed (dry run)\n`);
    } else {
      const cleared = await clearWorkoutReferences(prisma, ids);
      console.log(
        `✅ Cleared references — ${cleared.programDayOptions} options, ${cleared.programDays} days, ${cleared.workoutLogs} logs`,
      );

      const deleted = await prisma.workout.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(`✅ Deleted ${deleted.count} workout(s) from Postgres\n`);
    }

    if (CLEAN_SEED && ids.length > 0) {
      cleanSeedSnapshot(new Set(ids));
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});