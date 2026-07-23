import "server-only";

import path from "path";
import { hydrateJsonStore, isBlobConfigured } from "@/lib/demo-json-blob";
import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import {
  type GamificationEvent,
  type UserGamification,
} from "@/lib/gamification-types";
import { currentSeasonKey } from "@/lib/gamification-season";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import { writeGamificationAudit } from "@/lib/gamification-audit";

const BLOB_PATH = "demo/member-gamification.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-gamification.dev.json");

type BlobStore = Record<string, unknown>;

function normalizeUser(raw: unknown, userId: string): UserGamification {
  if (!raw || typeof raw !== "object") {
    return { userId, totalPoints: 0, events: [], updatedAt: new Date().toISOString() };
  }
  const data = raw as Partial<UserGamification>;
  const events = Array.isArray(data.events)
    ? data.events.filter((e): e is GamificationEvent => {
        if (!e || typeof e !== "object") return false;
        const ev = e as GamificationEvent;
        return typeof ev.id === "string" && typeof ev.points === "number";
      })
    : [];
  return {
    userId,
    totalPoints: events.reduce((s, e) => s + e.points, 0),
    events,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function loadBlobStore(): Promise<BlobStore> {
  if (!isBlobConfigured() && process.env.NODE_ENV === "production") {
    // Still try hydrate — local file fallback for dev
  }
  return (await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: null,
    setMemory: () => {},
    fallback: () => ({}),
    preferFresh: true,
  })) as BlobStore;
}

/** Merge two event lists by id (db wins on conflict for points/type). */
export function mergeGamificationEvents(
  primary: GamificationEvent[],
  secondary: GamificationEvent[],
): GamificationEvent[] {
  const map = new Map<string, GamificationEvent>();
  for (const e of secondary) map.set(e.id, e);
  for (const e of primary) map.set(e.id, e);
  return [...map.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Import all Blob/JSON ledger rows into Postgres (idempotent by event id).
 * Call from admin recompute / one-shot migrate script.
 */
export async function importBlobGamificationToDb(opts?: {
  actorId?: string;
}): Promise<{ users: number; imported: number; skipped: number }> {
  if (!isDatabaseConfigured()) {
    return { users: 0, imported: 0, skipped: 0 };
  }

  const store = await loadBlobStore();
  const levers = await getGamificationLevers();
  const seasonKey = currentSeasonKey(levers.seasonDays);
  let imported = 0;
  let skipped = 0;
  let users = 0;

  for (const [userId, raw] of Object.entries(store)) {
    if (!userId || userId.startsWith("_")) continue;
    const user = normalizeUser(raw, userId);
    if (!user.events.length) continue;
    users += 1;

    for (const ev of user.events) {
      try {
        await prisma.gamificationEvent.create({
          data: {
            id: ev.id,
            userId,
            type: String(ev.type),
            points: Math.max(0, Math.round(ev.points)),
            label: ev.label || String(ev.type),
            at: new Date(ev.at || Date.now()),
            programSlug: ev.programSlug ?? null,
            seasonKey,
          },
        });
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  if (opts?.actorId) {
    await writeGamificationAudit({
      action: "points.import_blob",
      actor: { actorId: opts.actorId, actorRole: "STAFF" },
      detail: { users, imported, skipped },
    });
  }

  return { users, imported, skipped };
}

/** Pull blob events for one user and insert any missing into DB. */
export async function ensureUserBlobImported(userId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const store = await loadBlobStore();
    const user = normalizeUser(store[userId], userId);
    if (!user.events.length) return 0;
    const levers = await getGamificationLevers();
    const seasonKey = currentSeasonKey(levers.seasonDays);
    let n = 0;
    for (const ev of user.events) {
      try {
        await prisma.gamificationEvent.create({
          data: {
            id: ev.id,
            userId,
            type: String(ev.type),
            points: Math.max(0, Math.round(ev.points)),
            label: ev.label || String(ev.type),
            at: new Date(ev.at || Date.now()),
            programSlug: ev.programSlug ?? null,
            seasonKey,
          },
        });
        n += 1;
      } catch {
        /* exists */
      }
    }
    return n;
  } catch {
    return 0;
  }
}

export async function loadBlobUserEvents(userId: string): Promise<GamificationEvent[]> {
  try {
    const store = await loadBlobStore();
    return normalizeUser(store[userId], userId).events;
  } catch {
    return [];
  }
}
