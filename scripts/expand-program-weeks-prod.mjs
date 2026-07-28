#!/usr/bin/env node
/**
 * Expand selected programs to N weeks (shell days) + clear rickroll placeholders from landing videos.
 *
 *   npx tsx scripts/expand-program-weeks-prod.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return orig.call(this, request, parent, isMain);
};

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.go-prod", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createPgPool } from "../src/lib/pg-connection.ts";
import { syncProgramSchedule } from "../src/lib/program-schedule.ts";
import { getLandingMedia, saveLandingMedia } from "../src/lib/landing-media-store.ts";

const TARGET = Number(process.env.WEEKS || "22");
const SLUGS = (
  process.env.PROGRAM_SLUGS ||
  "strength-training,boot-camp-preparation,mom-dads-little-time"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const prisma = new PrismaClient({
  adapter: new PrismaPg(createPgPool(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)),
});

for (const slug of SLUGS) {
  const p = await prisma.program.findUnique({ where: { slug } });
  if (!p) {
    console.log(slug, "missing");
    continue;
  }
  await prisma.program.update({
    where: { id: p.id },
    data: { durationWeeks: TARGET },
  });
  await syncProgramSchedule(p.id);
  const after = await prisma.program.findUnique({
    where: { id: p.id },
    select: { durationWeeks: true, _count: { select: { weeks: true } } },
  });
  console.log(slug, "→ durationWeeks", after?.durationWeeks, "weekRows", after?._count.weeks);
}

const media = await getLandingMedia();
const isRick = (u) => u && /dQw4w9WgXcQ/i.test(u);
const patch = {};
if (isRick(media.welcomeVideoUrl)) patch.welcomeVideoUrl = null;
if (isRick(media.freeChastiseVideoUrl)) patch.freeChastiseVideoUrl = null;
if (Object.keys(patch).length) {
  await saveLandingMedia(patch);
  console.log("cleared rickroll from", Object.keys(patch).join(", "));
} else {
  console.log("landing videos (no rickroll clear needed)");
}

await prisma.$disconnect();
console.log("Done.");
