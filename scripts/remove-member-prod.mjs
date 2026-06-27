#!/usr/bin/env node
/**
 * Remove a single self-registered member from production blob storage.
 *
 * Usage:
 *   node scripts/remove-member-prod.mjs john+test@lemonvoice.com
 */
import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/remove-member-prod.mjs <email>");
  process.exit(1);
}

const ACCOUNTS_PATH = "demo/registered-accounts.json";
const PROFILES_PATH = "demo/member-profiles.json";
const WAITLIST_PATH = "demo/waitlist.json";

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
  return { access: "public" };
}

async function readJson(path) {
  const opts = blobOptions();
  const meta = await head(path, opts);
  const res = await fetch(`${meta.url}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  return res.json();
}

async function writeJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function main() {
  const accounts = await readJson(ACCOUNTS_PATH);
  const account = accounts[emailArg];
  if (!account) {
    console.log(`No registered account for ${emailArg}`);
    const keys = Object.keys(accounts).filter((k) => k.includes("john") || k.includes("test"));
    if (keys.length) {
      console.log("Similar emails in accounts:", keys);
    }
    process.exit(0);
  }

  const userId = account.userId;
  console.log(`Removing ${emailArg} (${userId})...`);

  delete accounts[emailArg];
  await writeJson(ACCOUNTS_PATH, accounts);
  console.log("✓ registered-accounts.json");

  const profiles = await readJson(PROFILES_PATH);
  if (profiles[userId]) {
    delete profiles[userId];
    await writeJson(PROFILES_PATH, profiles);
    console.log("✓ member-profiles.json");
  } else {
    console.log("- no profile row");
  }

  const waitlist = await readJson(WAITLIST_PATH);
  if (Array.isArray(waitlist.entries)) {
    const before = waitlist.entries.length;
    waitlist.entries = waitlist.entries.filter((e) => e.email?.toLowerCase() !== emailArg);
    if (waitlist.entries.length < before) {
      await writeJson(WAITLIST_PATH, waitlist);
      console.log("✓ waitlist.json");
    } else {
      console.log("- not on waitlist");
    }
  }

  console.log("\nDone. They can sign up fresh with that email.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});