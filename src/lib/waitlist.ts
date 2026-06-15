import fs from "fs";
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

const DEV_FILE = path.join(process.cwd(), "prisma", "waitlist.dev.json");

function loadStore(): WaitlistStore {
  try {
    if (fs.existsSync(DEV_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_FILE, "utf8")) as WaitlistStore;
    }
  } catch {
    /* ignore */
  }
  return { entries: [] };
}

function saveStore(store: WaitlistStore) {
  fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
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