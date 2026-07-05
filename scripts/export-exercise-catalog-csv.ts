#!/usr/bin/env npx tsx
/**
 * Export prod exercise catalog to exports/exercise-catalog.csv
 *
 * Usage: npx tsx scripts/export-exercise-catalog-csv.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.production", override: true });

function resolveUrl(): string {
  const postgres = process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? "";
  const database = process.env.DATABASE_URL ?? "";
  return postgres || (database && !database.includes("dummy") ? database : "");
}

function csvEscape(value: string | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function main() {
  const url = resolveUrl();
  if (!url) {
    console.error("No DATABASE_URL");
    process.exit(1);
  }

  const pool = createPgPool(url);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, tags: true },
    });

    const lines = ["number,name,id,tags"];
    exercises.forEach((row, index) => {
      lines.push(
        [index + 1, csvEscape(row.name), row.id, csvEscape(row.tags ?? "")].join(","),
      );
    });

    mkdirSync("exports", { recursive: true });
    writeFileSync("exports/exercise-catalog.csv", `${lines.join("\n")}\n`, "utf8");
    console.log(`✅ Wrote ${exercises.length} exercises → exports/exercise-catalog.csv`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});