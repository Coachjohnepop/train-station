#!/usr/bin/env node
/**
 * Prepend coach standard warm-up on every program-day workout that is not rest / day off.
 *
 *   DRY_RUN=1 npx tsx scripts/ensure-warmups-on-program-days-prod.mjs
 *   npx tsx scripts/ensure-warmups-on-program-days-prod.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return orig.call(this, request, parent, isMain);
};

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";
import {
  isRestOrDayOffContent,
  workoutHasStandardWarmup,
} from "../src/lib/warmup-template.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
if (!url || url.includes("dummy")) {
  console.error("Need a real DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(createPgPool(url)) });

const options = await prisma.programDayOption.findMany({
  include: {
    workout: {
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
          include: { exercise: { select: { name: true } } },
        },
      },
    },
    day: { include: { week: { include: { program: { select: { slug: true } } } } } },
  },
});

const seen = new Set();
const stats = { rest: 0, already: 0, need: 0, added: 0, failed: 0 };

for (const opt of options) {
  const w = opt.workout;
  if (!w || seen.has(w.id)) continue;
  seen.add(w.id);
  const names = w.exercises.map((we) => we.exercise?.name || "");
  const loc = `${opt.day.week.program.slug} W${opt.day.week.weekNumber}D${opt.day.dayNumber} ${opt.trainingLocation || opt.label}`;
  if (
    isRestOrDayOffContent({
      workoutName: w.name,
      optionLabel: opt.label,
      exerciseNames: names,
    })
  ) {
    stats.rest += 1;
    continue;
  }
  if (workoutHasStandardWarmup(names)) {
    stats.already += 1;
    continue;
  }
  stats.need += 1;
  if (DRY_RUN) {
    console.log(`would seed ${w.id} @ ${loc} "${w.name}" (${names.length} ex)`);
    continue;
  }
  const { ensureWarmupsOnWorkout } = await import("../src/lib/seed-workout-warmups.ts");
  const result = await ensureWarmupsOnWorkout(w.id, { optionLabel: opt.label });
  if (result.added > 0) {
    stats.added += 1;
    console.log(`seeded ${result.added} @ ${loc} "${w.name}"`);
  } else if (result.skipped) {
    stats.already += 1;
    stats.need -= 1;
  } else {
    stats.failed += 1;
    console.log(`FAILED @ ${loc}: ${result.message}`);
  }
}

console.log(DRY_RUN ? "\nDRY RUN" : "\nDONE", stats);
await prisma.$disconnect();
