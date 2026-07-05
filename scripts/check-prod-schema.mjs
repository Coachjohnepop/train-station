#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ path: ".env.vercel.production", override: true });

const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL;
if (!url) {
  console.error("No Postgres URL");
  process.exit(1);
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.ts");
const { createPgPool } = await import("../src/lib/pg-connection.ts");

const prisma = new PrismaClient({ adapter: new PrismaPg(createPgPool(url)) });
const tables = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('WorkoutSetPhase','Equipment')
   ORDER BY 1`,
);
const cols = await prisma.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name='WorkoutExercise' AND column_name IN ('setCount','restBetweenSetsSec')`,
);
console.log("tables:", tables);
console.log("WorkoutExercise cols:", cols);
await prisma.$disconnect();