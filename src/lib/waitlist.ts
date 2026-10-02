import path from "path";
import { randomUUID } from "crypto";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  readBlobJson,
  writeBlobJson,
  readLocalJson,
  writeLocalJson,
} from "@/lib/demo-json-blob";
import {
  clearWaitlistInDb,
  deleteWaitlistByEmailFromDb,
  getWaitlistEntryByEmailFromDb,
  listWaitlistFromDb,
  upsertWaitlistEntryToDb,
} from "@/lib/waitlist-db";
import { normalizeLeadLane, type LeadLane } from "@/lib/waitlist-lane";

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
  lane?: LeadLane;
  laneAt?: string | null;
  joinLinkSentAt?: string | null;
};

function withLane(entry: WaitlistEntry): WaitlistEntry {
  return {
    ...entry,
    lane: normalizeLeadLane(entry.lane),
    laneAt: entry.laneAt ?? null,
    joinLinkSentAt: entry.joinLinkSentAt ?? null,
  };
}

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

  if (!isDemoMode()) {
    const existing = await getWaitlistEntryByEmailFromDb(email);
    if (existing) {
      const updated: WaitlistEntry = withLane({
        ...existing,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        phone: phone ?? existing.phone,
        name: name !== "Guest" ? name : existing.name,
        plan: input.plan ?? existing.plan,
        source: input.source ?? existing.source,
      });
      await upsertWaitlistEntryToDb(updated);
      return updated;
    }

    const entry: WaitlistEntry = withLane({
      id: randomUUID(),
      email,
      name,
      firstName,
      lastName,
      phone,
      plan: input.plan || null,
      source: input.source || null,
      createdAt: new Date().toISOString(),
      lane: "inbox",
    });
    await upsertWaitlistEntryToDb(entry);
    return entry;
  }

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
    return withLane(existing);
  }

  const entry: WaitlistEntry = withLane({
    id: randomUUID(),
    email,
    name,
    firstName,
    lastName,
    phone,
    plan: input.plan || null,
    source: input.source || null,
    createdAt: new Date().toISOString(),
    lane: "inbox",
  });

  store.entries.unshift(entry);
  await writeStore(store);
  return entry;
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  if (!isDemoMode()) return (await listWaitlistFromDb()).map(withLane);
  return (await readStore()).entries.map(withLane);
}

export async function clearWaitlist(): Promise<void> {
  if (!isDemoMode()) {
    await clearWaitlistInDb();
    return;
  }
  await writeStore({ entries: [] });
}

export async function removeWaitlistByEmail(email: string): Promise<boolean> {
  if (!isDemoMode()) return deleteWaitlistByEmailFromDb(email);
  const normalized = email.trim().toLowerCase();
  const store = await readStore();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.email.toLowerCase() !== normalized);
  if (store.entries.length === before) return false;
  await writeStore(store);
  return true;
}

/** Waitlist + ticket signups (registered members) for Admin → Leads. */
export async function listLeads(): Promise<WaitlistEntry[]> {
  const { listSelfRegisteredAccounts } = await import("@/lib/member-accounts-store");
  const { getMemberProfile } = await import("@/lib/member-profiles-store");

  const byEmail = new Map<string, WaitlistEntry>();
  const waitlistEntries = await listWaitlist();
  for (const entry of waitlistEntries) {
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

    byEmail.set(
      key,
      withLane({
        id: account.userId,
        email: key,
        name: account.name || "Member",
        firstName,
        lastName,
        phone: account.phone ?? profile?.phone ?? null,
        plan: profile?.plan ?? null,
        source: "signup-register",
        createdAt: account.createdAt,
        lane: "inbox",
      }),
    );
  }

  return [...byEmail.values()]
    .map(withLane)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function setLeadLane(
  email: string,
  lane: LeadLane,
): Promise<WaitlistEntry | null> {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = (await listLeads()).find((entry) => entry.email.toLowerCase() === normalized);
  if (!existing) return null;

  const updated = withLane({
    ...existing,
    email: normalized,
    lane,
    laneAt: now,
    joinLinkSentAt: lane === "convert" ? now : existing.joinLinkSentAt ?? null,
  });

  if (!isDemoMode()) {
    await upsertWaitlistEntryToDb(updated);
    return updated;
  }

  const store = await readStore();
  const index = store.entries.findIndex((entry) => entry.email.toLowerCase() === normalized);
  if (index >= 0) store.entries[index] = updated;
  else store.entries.unshift(updated);
  await writeStore(store);
  return updated;
}
