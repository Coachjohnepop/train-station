import "server-only";

import type { WaitlistEntry } from "@/lib/waitlist";
import { prisma } from "@/lib/prisma";
import { normalizeLeadLane } from "@/lib/waitlist-lane";

function toIso(value: Date): string {
  return value.toISOString();
}

function rowToEntry(row: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  plan: string | null;
  source: string | null;
  createdAt: Date;
  lane: string;
  laneAt: Date | null;
  joinLinkSentAt: Date | null;
}): WaitlistEntry {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    plan: row.plan,
    source: row.source,
    createdAt: toIso(row.createdAt),
    lane: normalizeLeadLane(row.lane),
    laneAt: row.laneAt ? toIso(row.laneAt) : null,
    joinLinkSentAt: row.joinLinkSentAt ? toIso(row.joinLinkSentAt) : null,
  };
}

function entryToRow(entry: WaitlistEntry) {
  return {
    id: entry.id,
    email: entry.email.trim().toLowerCase(),
    name: entry.name,
    firstName: entry.firstName ?? null,
    lastName: entry.lastName ?? null,
    phone: entry.phone ?? null,
    plan: entry.plan ?? null,
    source: entry.source ?? null,
    createdAt: new Date(entry.createdAt),
    lane: normalizeLeadLane(entry.lane),
    laneAt: entry.laneAt ? new Date(entry.laneAt) : null,
    joinLinkSentAt: entry.joinLinkSentAt ? new Date(entry.joinLinkSentAt) : null,
  };
}

export async function listWaitlistFromDb(): Promise<WaitlistEntry[]> {
  const rows = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(rowToEntry);
}

export async function getWaitlistEntryByEmailFromDb(email: string): Promise<WaitlistEntry | null> {
  const row = await prisma.waitlistEntry.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  return row ? rowToEntry(row) : null;
}

export async function upsertWaitlistEntryToDb(entry: WaitlistEntry): Promise<void> {
  const data = entryToRow(entry);
  await prisma.waitlistEntry.upsert({
    where: { email: data.email },
    create: data,
    update: {
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      plan: data.plan,
      source: data.source,
      lane: data.lane,
      laneAt: data.laneAt,
      joinLinkSentAt: data.joinLinkSentAt,
    },
  });
}

export async function deleteWaitlistByEmailFromDb(email: string): Promise<boolean> {
  const result = await prisma.waitlistEntry.deleteMany({
    where: { email: email.trim().toLowerCase() },
  });
  return result.count > 0;
}

export async function clearWaitlistInDb(): Promise<void> {
  await prisma.waitlistEntry.deleteMany({});
}

export async function probeWaitlistDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.waitlistEntry.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Waitlist DB probe failed";
    return { ok: false, message };
  }
}