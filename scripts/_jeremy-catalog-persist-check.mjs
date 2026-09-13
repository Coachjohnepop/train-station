#!/usr/bin/env node
/**
 * Confirm Jeremy's catalog writes are in Postgres (not blob).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.go-prod", override: true, quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

async function main() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
  if (!url || url.includes("dummy")) {
    console.error("No real Postgres URL");
    process.exit(1);
  }
  const host = url.replace(/.*@/, "").replace(/[:/?].*/, "");
  console.log("host", host);

  const pool = createPgPool(url);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    workouts,
    lines,
    exercises,
    days,
    options,
    recentWorkouts,
    adult,
  ] = await Promise.all([
    prisma.workout.count(),
    prisma.workoutExercise.count(),
    prisma.exercise.count(),
    prisma.programDay.count(),
    prisma.programDayOption.count(),
    prisma.workout.findMany({
      where: { updatedAt: { gte: since } },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.program.findFirst({
      where: { slug: "adult" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        weeks: {
          select: {
            weekNumber: true,
            days: {
              select: {
                id: true,
                dayNumber: true,
                notes: true,
                options: {
                  select: {
                    label: true,
                    workout: {
                      select: {
                        id: true,
                        name: true,
                        updatedAt: true,
                        _count: { select: { exercises: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  console.log("counts", { workouts, lines, exercises, days, options });
  console.log("workouts updated last 24h", recentWorkouts.length);
  for (const w of recentWorkouts) {
    console.log(" ", w.updatedAt.toISOString(), w.name);
  }

  const week1 = adult?.weeks?.find((w) => w.weekNumber === 1);
  if (week1) {
    console.log("adult week 1 days:");
    for (const d of week1.days) {
      const bits = d.options.map(
        (o) => `${o.label}:${o.workout?._count.exercises ?? 0}ex ${o.workout?.updatedAt?.toISOString() || ""}`,
      );
      console.log(`  D${d.dayNumber} ${d.notes || ""} · ${bits.join(" | ") || "no options"}`);
    }
  }

  const lineSample = await prisma.workoutExercise.findMany({
    take: 8,
    orderBy: { id: "desc" },
    select: {
      id: true,
      workoutId: true,
      sortOrder: true,
      sets: true,
      reps: true,
      notes: true,
      exercise: { select: { name: true } },
      workout: { select: { name: true, updatedAt: true } },
    },
  });
  console.log("newest-id workout lines:");
  for (const row of lineSample) {
    console.log(
      " ",
      row.workout.name,
      `#${row.sortOrder}`,
      row.exercise.name,
      `${row.sets ?? "?"}x${row.reps ?? "?"}`,
      row.workout.updatedAt.toISOString(),
    );
  }

  const recent7 = await prisma.workout.count({ where: { updatedAt: { gte: since7 } } });
  console.log("workouts touched last 7d", recent7);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
