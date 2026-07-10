#!/usr/bin/env node
/**
 * Remove prodtest loop artifacts (QA-MIGRATION, prodtest SMS workouts, chat msgs).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-database-prodtest.mjs
 *   node scripts/cleanup-database-prodtest.mjs
 */

import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const MARKER = process.env.TEST_MARKER || "prodtest";
const scriptDir = dirname(fileURLToPath(import.meta.url));

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
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const markers = [MARKER, "QA-MIGRATION", "lp-test", "PROG-ORDER"];
  const workoutNames = markers.map((m) => ({ contains: m, mode: "insensitive" }));

  const workouts = await prisma.workout.findMany({
    where: { OR: workoutNames.map((name) => ({ name })) },
    select: { id: true, name: true },
  });
  const workoutIds = workouts.map((w) => w.id);

  const chatMsgs = await prisma.coachChatMessage.findMany({
    where: {
      OR: markers.map((m) => ({ body: { contains: m, mode: "insensitive" } })),
    },
    select: { id: true, body: true },
  });

  console.log(`prodtest cleanup`);
  console.log(`  workouts: ${workouts.length}`);
  console.log(`  chat messages: ${chatMsgs.length}`);

  if (DRY_RUN) {
    console.log("\nDRY_RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  if (chatMsgs.length) {
    const delMsgs = await prisma.coachChatMessage.deleteMany({
      where: { id: { in: chatMsgs.map((m) => m.id) } },
    });
    console.log(`Deleted ${delMsgs.count} chat messages`);
  }

  if (workoutIds.length) {
    await prisma.programDayOption.deleteMany({ where: { workoutId: { in: workoutIds } } });
    await prisma.programDay.updateMany({
      where: { workoutId: { in: workoutIds } },
      data: { workoutId: null },
    });
    await prisma.workoutLog.deleteMany({ where: { workoutId: { in: workoutIds } } });
    const del = await prisma.workout.deleteMany({ where: { id: { in: workoutIds } } });
    console.log(`Deleted ${del.count} workouts`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});