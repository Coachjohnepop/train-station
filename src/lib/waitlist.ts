import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

export type WaitlistEntry = {
  id: string;
  email: string;
  name: string;
  plan?: string | null;
  source?: string | null;
  createdAt: string;
};

type WaitlistStore = {
  entries: WaitlistEntry[];
};

// Repo file: writable in local dev, READ-ONLY on Vercel's serverless FS.
const DEV_FILE = path.join(process.cwd(), "prisma", "waitlist.dev.json");
// Tmp file: the only writable location on Vercel (per-instance, ephemeral).
const TMP_FILE = path.join(os.tmpdir(), "waitlist.dev.json");

function loadStore(): WaitlistStore {
  // Prefer the tmp copy (holds the most recent writes on serverless), then
  // fall back to the committed repo file.
  for (const file of [TMP_FILE, DEV_FILE]) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8")) as WaitlistStore;
      }
    } catch {
      /* try next */
    }
  }
  return { entries: [] };
}

function saveStore(store: WaitlistStore) {
  const json = JSON.stringify(store, null, 2);
  // Try the repo file first (local dev); on a read-only FS (Vercel) fall back
  // to tmp. Never throw — a failed write must not break the signup flow. The
  // email notifier is the durable capture until the DB-backed store lands.
  try {
    fs.writeFileSync(DEV_FILE, json);
    return;
  } catch {
    /* read-only FS — fall through to tmp */
  }
  try {
    fs.writeFileSync(TMP_FILE, json);
  } catch (err) {
    console.error("[waitlist] could not persist entry:", err);
  }
}

export function addToWaitlist(input: {
  email: string;
  name?: string;
  plan?: string | null;
  source?: string | null;
}): WaitlistEntry {
  const email = input.email.trim().toLowerCase();
  const store = loadStore();
  const existing = store.entries.find((e) => e.email === email);

  if (existing) {
    if (input.name && !existing.name) existing.name = input.name;
    if (input.plan) existing.plan = input.plan;
    if (input.source) existing.source = input.source;
    saveStore(store);
    return existing;
  }

  const entry: WaitlistEntry = {
    id: randomUUID(),
    email,
    name: input.name?.trim() || "Guest",
    plan: input.plan || null,
    source: input.source || null,
    createdAt: new Date().toISOString(),
  };

  store.entries.unshift(entry);
  saveStore(store);
  return entry;
}

export function listWaitlist(): WaitlistEntry[] {
  return loadStore().entries;
}