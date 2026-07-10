#!/usr/bin/env node
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = createPgPool(url);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const program = await prisma.program.findFirst({
    where: { slug: "adult" },
    include: {
      weeks: {
        where: { weekNumber: 1 },
        include: {
          days: {
            where: { dayNumber: { in: [1, 2, 3] } },
            orderBy: { dayNumber: "asc" },
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
                include: {
                  workout: { select: { id: true, name: true, updatedAt: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!program) {
    console.log("No adult program");
    return;
  }

  for (const week of program.weeks) {
    for (const day of week.days) {
      console.log(`\nW${week.weekNumber}D${day.dayNumber} id=${day.id} legacyWorkoutId=${day.workoutId}`);
      for (const opt of day.options) {
        const exCount = opt.workout
          ? await prisma.workoutExercise.count({ where: { workoutId: opt.workout.id } })
          : 0;
        console.log(
          `  ${opt.label} (${opt.trainingLocation}) → ${opt.workoutId} "${opt.workout?.name}" exercises=${exCount} updated=${opt.workout?.updatedAt?.toISOString?.() || "?"}`,
        );
      }
      if (day.options.length === 0 && day.workoutId) {
        const w = await prisma.workout.findUnique({
          where: { id: day.workoutId },
          select: { id: true, name: true },
        });
        console.log(`  (legacy only) → ${w?.id} "${w?.name}"`);
      }
    }
  }

  const homeIds = [];
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const opt of day.options) {
        if (/^home$/i.test(opt.label)) homeIds.push({ day: day.dayNumber, id: opt.workoutId });
      }
    }
  }
  const dupes = homeIds.filter((h, i) => homeIds.findIndex((x) => x.id === h.id) !== i);
  if (dupes.length) {
    console.log("\n⚠️  DUPLICATE home workoutIds across days:");
    for (const h of homeIds) console.log(`  D${h.day} → ${h.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());