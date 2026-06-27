import dotenv from "dotenv";
import { head, put } from "@vercel/blob";

dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const ACCOUNTS_PATH = "demo/registered-accounts.json";
const PROFILES_PATH = "demo/member-profiles.json";
const WAITLIST_PATH = "demo/waitlist.json";

export function blobOptions() {
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

/**
 * Remove a self-registered member and any orphaned profile rows for the email.
 * Returns a summary; does not throw when the account is already absent.
 */
export async function removeMemberByEmail(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  const summary = {
    email,
    accountRemoved: false,
    profilesRemoved: 0,
    waitlistRemoved: 0,
    userId: null,
  };

  const accounts = await readJson(ACCOUNTS_PATH);
  const account = accounts[email];
  if (account?.userId) {
    summary.userId = account.userId;
    delete accounts[email];
    await writeJson(ACCOUNTS_PATH, accounts);
    summary.accountRemoved = true;
  }

  const profiles = await readJson(PROFILES_PATH);
  let profilesDirty = false;
  for (const [userId, profile] of Object.entries(profiles)) {
    if (profile?.email?.toLowerCase() === email) {
      delete profiles[userId];
      summary.profilesRemoved += 1;
      profilesDirty = true;
    }
  }
  if (profilesDirty) {
    await writeJson(PROFILES_PATH, profiles);
  }

  const waitlist = await readJson(WAITLIST_PATH);
  if (Array.isArray(waitlist.entries)) {
    const before = waitlist.entries.length;
    waitlist.entries = waitlist.entries.filter((e) => e.email?.toLowerCase() !== email);
    summary.waitlistRemoved = before - waitlist.entries.length;
    if (summary.waitlistRemoved > 0) {
      await writeJson(WAITLIST_PATH, waitlist);
    }
  }

  return summary;
}