#!/usr/bin/env node
/**
 * Drop consecutive clone workout lines (same exercise + sets + reps + scheme).
 * Dry-run by default. APPLY=1 to delete.
 */
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
if (!url || url.includes("dummy")) {
  console.error("Need a real DATABASE_URL");
  process.exit(1);
}

const apply = process.env.APPLY === "1";
const prisma = new PrismaClient({ adapter: new PrismaPg(createPgPool(url)) });

const allWe = await prisma.workoutExercise.findMany({
  orderBy: [{ workoutId: "asc" }, { sortOrder: "asc" }],
  include: { exercise: { select: { name: true } }, workout: { select: { name: true } } },
});

const dropIds = [];
for (let i = 1; i < allWe.length; i++) {
  const a = allWe[i - 1];
  const b = allWe[i];
  if (a.workoutId !== b.workoutId) continue;
  if (a.exerciseId !== b.exerciseId) continue;
  if ((a.setCount ?? a.sets) !== (b.setCount ?? b.sets)) continue;
  if ((a.reps || "") !== (b.reps || "")) continue;
  if ((a.setScheme || "") !== (b.setScheme || "")) continue;
  dropIds.push(b.id);
  console.log(
    `${apply ? "DROP" : "would drop"} ${b.id} "${b.exercise?.name}" from ${b.workout?.name}`,
  );
}

if (apply && dropIds.length) {
  const deleted = await prisma.workoutExercise.deleteMany({
    where: { id: { in: dropIds } },
  });
  console.log(`deleted ${deleted.count}`);
} else {
  console.log(`${dropIds.length} clone line(s). APPLY=1 to delete.`);
}

await prisma.$disconnect();
