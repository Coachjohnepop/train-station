#!/usr/bin/env node
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg(createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)),
});

async function show(workoutId, label) {
  const w = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });
  console.log(`\n${label} ${workoutId} "${w?.name}" workout-updated=${w?.updatedAt?.toISOString()}`);
  for (const e of w?.exercises || []) {
    console.log(
      `  [${e.sortOrder}] ${e.exercise?.name || e.exerciseId} sets=${e.sets} reps=${e.reps} id=${e.id} updated=${e.updatedAt?.toISOString?.()}`,
    );
  }
}

async function main() {
  await show("womq4prctm", "W1D1 Home (kept)");
  await show("cmrf1hlh0000d04l23e9ixxlj", "W1D2 Home (clone)");

  const recent = await prisma.workout.findMany({
    where: { updatedAt: { gte: new Date("2026-07-08T00:00:00Z") } },
    orderBy: { updatedAt: "desc" },
    take: 25,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      _count: { select: { exercises: true } },
    },
  });
  console.log("\nWorkouts updated since Jul 8:");
  for (const r of recent) {
    console.log(`  ${r.updatedAt?.toISOString()} ${r.id} "${r.name}" ex=${r._count.exercises}`);
  }

  // W1D1 gym for comparison
  await show("cmpzkkryb000s95rzdsxn44js", "W1D1 Gym");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());