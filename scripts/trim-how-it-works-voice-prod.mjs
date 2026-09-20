#!/usr/bin/env node
/**
 * Trim How it Works Jeremy clips to speech ± 0.3s of silence.
 *   npx tsx scripts/trim-how-it-works-voice-prod.mjs
 */
import { createRequire } from "module";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { normalizeHowItWorks } from "../src/lib/how-it-works.ts";

const require = createRequire(import.meta.url);
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.vercel.production", override: true });
dotenv.config({ path: ".env.vercel.prod", override: true });

/** Speech ± 0.3s, measured 2026-09-20 from live How it Works blobs. */
const TRIMS = {
  workout: { startSec: 1.06, endSec: 16.54 },
  ticket: { startSec: 0, endSec: 5.38 },
  program: { startSec: 0, endSec: 5.62 },
  gear: { startSec: 0, endSec: 10.68 },
  book: { startSec: 0.02, endSec: 18.44 },
};

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";
  if (!url || url.includes("dummy")) {
    throw new Error("Need real Postgres URL");
  }
  return url;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const row = await prisma.landingMediaSettings.findUnique({ where: { id: "default" } });
  if (!row) throw new Error("No landingMediaSettings");
  const howItWorks = normalizeHowItWorks(row.howItWorks);
  howItWorks.steps = howItWorks.steps.map((step) => {
    const trim = TRIMS[step.id];
    if (!trim || !step.voice.audioUrl) return step;
    return {
      ...step,
      voice: { ...step.voice, startSec: trim.startSec, endSec: trim.endSec },
    };
  });
  for (const step of howItWorks.steps) {
    console.log(step.id, step.voice.startSec, "→", step.voice.endSec);
  }
  await prisma.landingMediaSettings.update({
    where: { id: "default" },
    data: { howItWorks },
  });
  await prisma.$disconnect();
  await pool.end();
  console.log("Saved How it Works voice trims.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
