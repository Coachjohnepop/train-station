#!/usr/bin/env node
/**
 * Clone shared Gym/Home workouts so each program day option has its own workout row.
 * Fixes legacy import data where multiple days pointed at the same workoutId.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/fix-shared-program-workouts-prodtest.mjs
 *   npx tsx scripts/fix-shared-program-workouts-prodtest.mjs
 *   PROGRAM_SLUG=adult npx tsx scripts/fix-shared-program-workouts-prodtest.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { createCoachClient } from "./lib/coach-auth.mjs";
import { cloneWorkoutContentName } from "../src/lib/workout-content-name.ts";

const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";

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
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(resolveDatabaseUrl())),
  });

  const program = await prisma.program.findFirst({
    where: { slug: PROGRAM_SLUG },
    include: {
      weeks: {
        include: {
          days: {
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
                include: { workout: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!program) throw new Error(`Program not found: ${PROGRAM_SLUG}`);

  const usage = new Map();
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const opt of day.options) {
        if (!opt.workoutId) continue;
        const key = opt.workoutId;
        const list = usage.get(key) || [];
        list.push({
          week: week.weekNumber,
          day: day.dayNumber,
          dayId: day.id,
          optionId: opt.id,
          label: opt.label,
          workoutName: opt.workout?.name || key,
        });
        usage.set(key, list);
      }
    }
  }

  const shared = [...usage.entries()].filter(([, refs]) => refs.length > 1);
  console.log(`\nfix-shared-program-workouts [${PROGRAM_SLUG}]`);
  console.log(`Shared workoutIds: ${shared.length}`);

  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach())) {
    throw new Error("Coach login failed — set COACH_PASSWORD");
  }

  let cloned = 0;
  for (const [workoutId, refs] of shared) {
    console.log(`\n${workoutId} "${refs[0].workoutName}" used on ${refs.length} day options:`);
    for (const r of refs) console.log(`  W${r.week}D${r.day} ${r.label} option=${r.optionId}`);

    const [, ...duplicates] = refs;
    for (const dup of duplicates) {
      if (DRY_RUN) {
        console.log(`  DRY_RUN would clone for W${dup.week}D${dup.day} ${dup.label}`);
        continue;
      }
      const cloneRes = await req(`/api/workouts/${workoutId}/clone`, {
        method: "POST",
        json: { name: cloneWorkoutContentName(dup.workoutName, dup.label) },
      });
      if (!cloneRes.res.ok || !cloneRes.body?.id) {
        throw new Error(`clone failed ${workoutId}: ${cloneRes.res.status} ${cloneRes.text?.slice(0, 120)}`);
      }
      await prisma.programDayOption.update({
        where: { id: dup.optionId },
        data: { workoutId: cloneRes.body.id },
      });
      console.log(`  ✓ W${dup.week}D${dup.day} ${dup.label} → ${cloneRes.body.id}`);
      cloned++;
    }
  }

  console.log(`\nDone — ${cloned} option(s) assigned unique workout clones.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});