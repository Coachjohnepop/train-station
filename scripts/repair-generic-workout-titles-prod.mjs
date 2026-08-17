#!/usr/bin/env node
/**
 * Rename generic "Workout" / "Workout · …" rows from their exercise lines.
 * Does not merge or relink days (each option keeps its own workout id).
 *
 *   DRY_RUN=1 npx tsx scripts/repair-generic-workout-titles-prod.mjs
 *   npx tsx scripts/repair-generic-workout-titles-prod.mjs
 */
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";
import {
  isGenericWorkoutTitle,
  salvageGenericWorkoutTitle,
} from "../src/lib/workout-content-name.ts";

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

const seen = new Map();
const counts = {};

for (const opt of options) {
  const w = opt.workout;
  if (!w || !isGenericWorkoutTitle(w.name)) continue;
  if (seen.has(w.id)) continue;
  const names = w.exercises.map((we) => we.exercise?.name || we.blockName || "").filter(Boolean);
  const next = salvageGenericWorkoutTitle(w.name, names);
  seen.set(w.id, { from: w.name, to: next, ex: names.length });
  counts[next] = (counts[next] || 0) + 1;
  const loc = `${opt.day.week.program.slug} W${opt.day.week.weekNumber}D${opt.day.dayNumber}`;
  console.log(`${DRY_RUN ? "would" : "rename"} ${w.id} @ ${loc}: "${w.name}" → "${next}" (${names.length} ex)`);
}

if (!DRY_RUN) {
  for (const [id, { to }] of seen) {
    await prisma.workout.update({ where: { id }, data: { name: to } });
  }
}

console.log(
  `\n${DRY_RUN ? "would rename" : "renamed"} ${seen.size} workouts`,
  JSON.stringify(counts, null, 2),
);

await prisma.$disconnect();
