import path from "path";
import { randomUUID } from "crypto";
import {
  hydrateJsonStore,
  persistJsonStore,
  readLocalJson,
} from "@/lib/demo-json-blob";

export type WaitlistEntry = {
  id: string;
  email: string;
  name: string; // combined display name (first + last), kept for convenience
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  plan?: string | null;
  source?: string | null;
  createdAt: string;
};

type WaitlistStore = {
  entries: WaitlistEntry[];
};

// Persisted via the shared demo store: local JSON in dev, Vercel Blob in prod
// (durable + shared across serverless instances) when BLOB_READ_WRITE_TOKEN is
// set. This is the same mechanism chat/SMS/today use, so leads survive and are
// visible to the admin dashboard.
const DEV_FILE = path.join(process.cwd(), "prisma", "waitlist.dev.json");
const BLOB_PATH = "demo/waitlist.json";

let memoryStore: WaitlistStore | null = null;

function emptyStore(): WaitlistStore {
  return { entries: [] };
}

function setMemory(store: WaitlistStore) {
  memoryStore = store;
}

async function hydrate(): Promise<WaitlistStore> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
  });
}

function readStore(): WaitlistStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<WaitlistStore>(DEV_FILE) || emptyStore();
  return memoryStore;
}

async function writeStore(store: WaitlistStore) {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

export async function addToWaitlist(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  plan?: string | null;
  source?: string | null;
}): Promise<WaitlistEntry> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const phone = input.phone?.trim() || null;
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Guest";

  await hydrate();
  const store = readStore();
  const existing = store.entries.find((e) => e.email === email);

  if (existing) {
    if (firstName) existing.firstName = firstName;
    if (lastName) existing.lastName = lastName;
    if (phone) existing.phone = phone;
    if (name !== "Guest") existing.name = name;
    if (input.plan) existing.plan = input.plan;
    if (input.source) existing.source = input.source;
    await writeStore(store);
    return existing;
  }

  const entry: WaitlistEntry = {
    id: randomUUID(),
    email,
    name,
    firstName,
    lastName,
    phone,
    plan: input.plan || null,
    source: input.source || null,
    createdAt: new Date().toISOString(),
  };

  store.entries.unshift(entry);
  await writeStore(store);
  return entry;
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  await hydrate();
  return readStore().entries;
}
