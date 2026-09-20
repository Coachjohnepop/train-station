#!/usr/bin/env node
/**
 * Today’s How it Works clip is stereo with a silent right channel.
 * Upload a dual-mono AAC so Jeremy is in both speakers.
 */
import { createRequire } from "module";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { put } from "@vercel/blob";
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

function resolveDatabaseUrl() {
  const url =
    process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  if (!url || url.includes("dummy")) throw new Error("Need real Postgres URL");
  return url;
}

async function main() {
  const pool = createPgPool(resolveDatabaseUrl());
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const row = await prisma.landingMediaSettings.findUnique({ where: { id: "default" } });
  if (!row) throw new Error("No landingMediaSettings");
  const howItWorks = normalizeHowItWorks(row.howItWorks);
  const workout = howItWorks.steps.find((s) => s.id === "workout");
  if (!workout?.voice.audioUrl) throw new Error("No workout clip");

  const src = join(tmpdir(), `hiw-workout-src-${randomUUID()}`);
  const out = join(tmpdir(), `hiw-workout-dual-${randomUUID()}.m4a`);
  execFileSync("curl", ["-sS", "-L", workout.voice.audioUrl, "-o", src]);
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-y",
    "-i",
    src,
    "-af",
    "pan=stereo|c0=c0+c1|c1=c0+c1",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    out,
  ]);

  const buf = readFileSync(out);
  const uploaded = await put(`hero/how-it-works/workout-${randomUUID()}.m4a`, buf, {
    access: "public",
    contentType: "audio/mp4",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  console.log("uploaded", uploaded.url);

  howItWorks.steps = howItWorks.steps.map((step) =>
    step.id === "workout"
      ? { ...step, voice: { ...step.voice, audioUrl: uploaded.url } }
      : step,
  );
  await prisma.landingMediaSettings.update({
    where: { id: "default" },
    data: { howItWorks },
  });
  await prisma.$disconnect();
  await pool.end();
  console.log("Saved dual-mono Today clip.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
