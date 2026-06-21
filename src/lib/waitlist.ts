import path from "path";
import { randomUUID } from "crypto";
import {
  readBlobJson,
  writeBlobJson,
  readLocalJson,
  writeLocalJson,
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

const DEV_FILE = path.join(process.cwd(), "prisma", "waitlist.dev.json");
const BLOB_PATH = "demo/waitlist.json";

// Always read fresh — NO in-memory cache. On Vercel the read/write instances
// differ, so any cached copy goes stale and the admin dashboard shows nothing.
// Blob is the source of truth in prod; local JSON is the source in dev.
async function readStore(): Promise<WaitlistStore> {
  const fromBlob = await readBlobJson<WaitlistStore>(BLOB_PATH);
  if (fromBlob && Array.isArray(fromBlob.entries)) return fromBlob;
  return readLocalJson<WaitlistStore>(DEV_FILE) || { entries: [] };
}

async function writeStore(store: WaitlistStore): Promise<void> {
  writeLocalJson(DEV_FILE, store); // dev (no-ops/caught on read-only prod FS)
  await writeBlobJson(BLOB_PATH, store); // prod: durable + shared across instances
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

  const store = await readStore();
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
  return (await readStore()).entries;
}

/** Waitlist + ticket signups (registered members) for Admin → Leads. */
export async function listLeads(): Promise<WaitlistEntry[]> {
  const { listSelfRegisteredAccounts } = await import("@/lib/member-accounts-store");
  const { getMemberProfile } = await import("@/lib/member-profiles-store");

  const byEmail = new Map<string, WaitlistEntry>();
  for (const entry of (await readStore()).entries) {
    byEmail.set(entry.email.toLowerCase(), entry);
  }

  const registered = await listSelfRegisteredAccounts();
  for (const { email, account } of registered) {
    const key = email.toLowerCase();
    if (byEmail.has(key)) continue;

    const profile = await getMemberProfile(account.userId);
    const nameParts = (account.name || "").trim().split(/\s+/);
    const firstName = nameParts.shift() || null;
    const lastName = nameParts.join(" ") || null;

    byEmail.set(key, {
      id: account.userId,
      email: key,
      name: account.name || "Member",
      firstName,
      lastName,
      phone: account.phone ?? profile?.phone ?? null,
      plan: profile?.plan ?? null,
      source: "signup-register",
      createdAt: account.createdAt,
    });
  }

  return [...byEmail.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
