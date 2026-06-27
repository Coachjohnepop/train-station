#!/usr/bin/env node
/**
 * Set or update sign-in password for an email in production registered-accounts blob.
 * Seed coach emails (jeremy@, john@) are overlaid in the blob so login works.
 *
 * Usage:
 *   node scripts/set-account-password-blob.mjs coachjohnepop@yahoo.com 'TestPass123!'
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

if (process.env.VERCEL !== "1") {
  dotenv.config({ path: ".env.vercel.prod" });
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

const ACCOUNTS_PATH = "demo/registered-accounts.json";
const SEED_FILE = new URL("../prisma/accounts.dev.json", import.meta.url);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function blobOptions() {
  const storeId = process.env.BLOB_STORE_ID?.startsWith("store_")
    ? process.env.BLOB_STORE_ID
    : process.env.BLOB_STORE_ID
      ? `store_${process.env.BLOB_STORE_ID}`
      : null;
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.TS_BLOB_TOKEN;
  if (storeId && process.env.VERCEL_OIDC_TOKEN) {
    return { access: "public", storeId, oidcToken: process.env.VERCEL_OIDC_TOKEN };
  }
  if (token) return { access: "public", token };
  throw new Error("Blob not configured — set BLOB_STORE_ID + token in .env.vercel.prod");
}

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  const result = await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return result;
}

async function loadSeed() {
  try {
    const fs = await import("fs");
    return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function setAccountPasswordBlob(email, password) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password || password.length < 8) {
    throw new Error("Email and password (8+ chars) required.");
  }

  const accounts = await readJson(ACCOUNTS_PATH);
  const seed = await loadSeed();
  const existing = accounts[normalized];
  const seedEntry = seed[normalized];

  if (!existing && !seedEntry) {
    throw new Error(`No account found for ${normalized} in blob or seed.`);
  }

  const base = existing || {
    userId: seedEntry.userId,
    role: seedEntry.role,
    name: seedEntry.name || normalized.split("@")[0],
    phone: seedEntry.phone ?? null,
    createdAt: new Date().toISOString(),
  };

  const passwordHash = hashPassword(password);

  for (let attempt = 1; attempt <= 4; attempt++) {
    const latest = await readJson(ACCOUNTS_PATH);
    const row = latest[normalized] || base;
    latest[normalized] = { ...row, ...base, passwordHash };
    const putResult = await writeJson(ACCOUNTS_PATH, latest);

    const verifyRes = await fetch(`${putResult.url}?_verify=${Date.now()}`, {
      cache: "no-store",
    });
    const verifyStore = verifyRes.ok ? await verifyRes.json() : null;
    const saved = verifyStore?.[normalized]?.passwordHash;
    if (saved && verifyPassword(password, saved)) {
      return { email: normalized, userId: base.userId, role: base.role };
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  throw new Error(`Password write for ${normalized} did not persist — try again.`);
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMain) {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: node scripts/set-account-password-blob.mjs <email> <password>");
    process.exit(1);
  }

  try {
    const result = await setAccountPasswordBlob(email, password);
    console.log(`✓ Password set for ${result.email} (${result.role}, ${result.userId})`);
  } catch (e) {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}