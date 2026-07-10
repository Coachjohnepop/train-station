#!/usr/bin/env node
/**
 * When Home shares a workout with another day OR mismatches its Gym day theme,
 * clone the catalog Home template (e.g. Day 2 Lower Body Home) so coaches keep
 * data without re-entry.
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/restore-mismatched-home-workouts-prodtest.mjs
 *   npx tsx scripts/restore-mismatched-home-workouts-prodtest.mjs
 */

import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { createCoachClient } from "./lib/coach-auth.mjs";
import {
  cloneWorkoutContentName,
  findCatalogHomeForProgramDay,
  workoutsMatchByContentTitle,
} from "../src/lib/workout-content-name.ts";
import { isGymLabel, isHomeLabel, programDaysUsingWorkout } from "../src/lib/program-calendar.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const PROGRAM_SLUG = process.env.PROGRAM_SLUG || "adult";
const BASE = (process.env.BASE_URL || "https://www.thetrainstation.co").replace(/\/$/, "");
/** e.g. RESTORE_ONLY=W1D2 to fix a single calendar day */
const RESTORE_ONLY = process.env.RESTORE_ONLY || "";

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) throw new Error("DATABASE_URL required");
  return url;
}

function buildProgramShape(program) {
  return {
    weeks: program.weeks.map((w) => ({
      days: w.days.map((d) => ({
        id: d.id,
        workoutId: d.workoutId,
        options: d.options.map((o) => ({ workoutId: o.workoutId, label: o.label })),
      })),
    })),
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(createPgPool(resolveDatabaseUrl())),
  });

  const program = await prisma.program.findFirst({
    where: { slug: PROGRAM_SLUG },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
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

  const library = await prisma.workout.findMany({
    select: { id: true, name: true },
  });

  const { req, loginCoach } = createCoachClient(BASE);
  if (!(await loginCoach())) throw new Error("Coach login failed");

  const programShape = buildProgramShape(program);
  let fixed = 0;

  console.log(`\nrestore-mismatched-home-workouts [${PROGRAM_SLUG}] DRY_RUN=${DRY_RUN}\n`);

  for (const week of program.weeks) {
    for (const day of week.days) {
      if (RESTORE_ONLY) {
        const tag = `W${week.weekNumber}D${day.dayNumber}`;
        if (tag !== RESTORE_ONLY) continue;
      }

      const gymOpt = day.options.find((o) => isGymLabel(o.label) && o.workoutId);
      const homeOpt = day.options.find((o) => isHomeLabel(o.label) && o.workoutId);
      if (!gymOpt?.workout || !homeOpt?.workout) continue;

      const themeMismatch = !workoutsMatchByContentTitle(
        gymOpt.workout.name,
        homeOpt.workout.name,
      );
      const gymUpperDay1 =
        day.dayNumber === 1 && /upper|push|chest|shoulder/i.test(gymOpt.workout.name);
      if (!themeMismatch || gymUpperDay1) continue;

      const template = findCatalogHomeForProgramDay(
        day.dayNumber,
        gymOpt.workout.name,
        library,
      );
      if (!template) {
        console.log(
          `○ W${week.weekNumber}D${day.dayNumber} — no Home template for "${gymOpt.workout.name}"`,
        );
        continue;
      }

      console.log(
        `→ W${week.weekNumber}D${day.dayNumber} Home (theme-mismatch): "${homeOpt.workout.name}" → template "${template.name}"`,
      );

      if (DRY_RUN) continue;

      const cloneRes = await req(`/api/workouts/${template.id}/clone`, {
        method: "POST",
        json: { name: cloneWorkoutContentName(template.name, "Home") },
      });
      if (!cloneRes.res.ok || !cloneRes.body?.id) {
        throw new Error(`clone failed: ${cloneRes.res.status} ${cloneRes.text?.slice(0, 120)}`);
      }

      await prisma.programDayOption.update({
        where: { id: homeOpt.id },
        data: { workoutId: cloneRes.body.id },
      });
      console.log(`  ✓ assigned ${cloneRes.body.id}`);
      fixed++;
    }
  }

  console.log(`\nDone — ${fixed} Home workout(s) realigned.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});