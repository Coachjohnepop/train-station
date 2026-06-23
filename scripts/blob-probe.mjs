#!/usr/bin/env node
/**
 * Probe Vercel Blob read/write using env from .env.vercel.prod or .env.local.
 * Usage: node scripts/blob-probe.mjs
 */
import dotenv from "dotenv";
import fs from "fs";
import { head, put } from "@vercel/blob";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const tokens = [
  ["BLOB_READ_WRITE_TOKEN", process.env.BLOB_READ_WRITE_TOKEN],
  ["TS_BLOB_TOKEN", process.env.TS_BLOB_TOKEN],
].filter(([, v]) => v);

if (!tokens.length) {
  console.error("NO_TOKEN — set BLOB_READ_WRITE_TOKEN or TS_BLOB_TOKEN");
  process.exit(1);
}

async function probeToken(name, token) {
  const path = `demo/persistence-probe-${name}.json`;
  const body = JSON.stringify({ probe: Date.now(), token: name });
  try {
    await put(path, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });
    const meta = await head(path, { token });
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    console.log(`✅ ${name} — write OK`);
    return true;
  } catch (e) {
    console.error(`❌ ${name}:`, e.message || e);
    return false;
  }
}

let anyOk = false;
for (const [name, token] of tokens) {
  if (await probeToken(name, token)) anyOk = true;
}

if (fs.existsSync("prisma/seed-data.json")) {
  const seed = fs.readFileSync("prisma/seed-data.json", "utf8");
  console.log(`\nSeed file: ${seed.length} bytes`);
}

process.exit(anyOk ? 0 : 1);