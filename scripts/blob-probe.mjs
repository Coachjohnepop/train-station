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

async function probeMode(name, options) {
  const path = `demo/persistence-probe-${name}.json`;
  const body = JSON.stringify({ probe: Date.now(), mode: name });
  try {
    await put(path, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...options,
    });
    const meta = await head(path, options);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    console.log(`✅ ${name} — write OK`);
    return true;
  } catch (e) {
    console.error(`❌ ${name}:`, e.message || e);
    return false;
  }
}

const storeId = process.env.BLOB_STORE_ID?.startsWith("store_")
  ? process.env.BLOB_STORE_ID
  : process.env.BLOB_STORE_ID
    ? `store_${process.env.BLOB_STORE_ID}`
    : null;

let anyOk = false;
if (storeId && process.env.VERCEL_OIDC_TOKEN) {
  anyOk =
    (await probeMode("OIDC", {
      storeId,
      oidcToken: process.env.VERCEL_OIDC_TOKEN,
    })) || anyOk;
}

for (const [name, token] of [
  ["BLOB_READ_WRITE_TOKEN", process.env.BLOB_READ_WRITE_TOKEN],
  ["TS_BLOB_TOKEN", process.env.TS_BLOB_TOKEN],
].filter(([, v]) => v)) {
  if (await probeMode(name, { token })) anyOk = true;
}

if (!anyOk && !storeId && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.TS_BLOB_TOKEN) {
  console.error("NO_CREDENTIALS — set BLOB_STORE_ID+VERCEL_OIDC_TOKEN or a read-write token");
  process.exit(1);
}

if (fs.existsSync("prisma/seed-data.json")) {
  const seed = fs.readFileSync("prisma/seed-data.json", "utf8");
  console.log(`\nSeed file: ${seed.length} bytes`);
}

process.exit(anyOk ? 0 : 1);