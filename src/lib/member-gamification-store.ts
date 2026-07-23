import "server-only";

import path from "path";
import { hydrateJsonStore, isBlobConfigured, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { isDatabaseConfigured } from "@/lib/database-config";
import { getGamificationPointsConfig } from "@/lib/gamification-config";
import {
  type GamificationEvent,
  type GamificationEventType,
  type UserGamification,
} from "@/lib/gamification-types";
import { prisma } from "@/lib/prisma";
import { getGamificationLevers } from "@/lib/gamification-config-store";
import { currentSeasonKey, recomputeUserSeasonScore } from "@/lib/gamification-season";
import { divisionForPlan } from "@/lib/gamification-levers";
import { getMemberProfile } from "@/lib/member-profiles-store";

type GamificationStore = Record<string, UserGamification>;

const BLOB_PATH = "demo/member-gamification.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-gamification.dev.json");

let memoryStore: GamificationStore | null = null;

function sumEventPoints(events: GamificationEvent[]): number {
  return events.reduce((sum, e) => sum + e.points, 0);
}

function emptyUser(userId: string): UserGamification {
  return { userId, totalPoints: 0, events: [], updatedAt: new Date().toISOString() };
}

function normalizeUser(raw: unknown, userId: string): UserGamification {
  if (!raw || typeof raw !== "object") return emptyUser(userId);
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
    totalPoints: sumEventPoints(events),
    events,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

function preferFreshReads(): boolean {
  return isBlobConfigured();
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<GamificationStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as GamificationStore) || {};
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated as GamificationStore;
  return memoryStore;
}

function rowToEvent(row: {
  id: string;
  type: string;
  points: number;
  label: string;
  at: Date;
  programSlug: string | null;
}): GamificationEvent {
  return {
    id: row.id,
    type: row.type as GamificationEventType,
    points: row.points,
    label: row.label,
    at: row.at.toISOString(),
    programSlug: row.programSlug,
  };
}

async function getUserGamificationDb(userId: string): Promise<UserGamification> {
  const rows = await prisma.gamificationEvent.findMany({
    where: { userId },
    orderBy: { at: "asc" },
  });
  const events = rows.map(rowToEvent);
  return {
    userId,
    totalPoints: sumEventPoints(events),
    events,
    updatedAt: rows.length
      ? rows[rows.length - 1].at.toISOString()
      : new Date().toISOString(),
  };
}

export async function getUserGamification(userId: string): Promise<UserGamification> {
  if (isDatabaseConfigured()) {
    try {
      return await getUserGamificationDb(userId);
    } catch (e) {
      console.error("getUserGamification db", e);
      // fall through to blob for local/demo
    }
  }
  const store = await getStore({ preferFresh: preferFreshReads() });
  return normalizeUser(store[userId], userId);
}

export async function listAllGamification(): Promise<UserGamification[]> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await prisma.gamificationEvent.findMany({ orderBy: { at: "asc" } });
      const byUser = new Map<string, GamificationEvent[]>();
      for (const row of rows) {
        const list = byUser.get(row.userId) || [];
        list.push(rowToEvent(row));
        byUser.set(row.userId, list);
      }
      return [...byUser.entries()].map(([userId, events]) => ({
        userId,
        totalPoints: sumEventPoints(events),
        events,
        updatedAt: events.length ? events[events.length - 1].at : new Date().toISOString(),
      }));
    } catch (e) {
      console.error("listAllGamification db", e);
    }
  }
  const store = await getStore({ preferFresh: preferFreshReads() });
  return Object.entries(store).map(([userId, raw]) => normalizeUser(raw, userId));
}

export async function removeGamificationForUsers(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;

  if (isDatabaseConfigured()) {
    try {
      const result = await prisma.gamificationEvent.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.gamificationSeasonScore.deleteMany({
        where: { userId: { in: userIds } },
      });
      return result.count;
    } catch (e) {
      console.error("removeGamificationForUsers db", e);
    }
  }

  const store = await getStore({ preferFresh: true });
  let removed = 0;
  for (const id of userIds) {
    if (store[id]) {
      delete store[id];
      removed += 1;
    }
  }
  if (removed > 0) {
    const { blobSaved } = await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v as GamificationStore;
      },
    });
    requireBlobPersisted(blobSaved, "Gamification removal");
  }
  return removed;
}

function userHasEvent(userId: string, eventId: string): boolean {
  const verified = normalizeUser(memoryStore?.[userId], userId);
  return verified.events.some((e) => e.id === eventId);
}

async function awardDb(input: {
  userId: string;
  eventId: string;
  type: GamificationEventType;
  label?: string;
  points: number;
  programSlug?: string | null;
}): Promise<{ awarded: boolean; totalPoints: number; pointsEarned: number }> {
  const existing = await prisma.gamificationEvent.findUnique({
    where: { id: input.eventId },
    select: { id: true },
  });
  if (existing) {
    const user = await getUserGamificationDb(input.userId);
    return { awarded: false, totalPoints: user.totalPoints, pointsEarned: 0 };
  }

  // Daily point cap (season economy)
  const levers = await getGamificationLevers();
  if (levers.dailyPointCap > 0) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const todaySum = await prisma.gamificationEvent.aggregate({
      where: { userId: input.userId, at: { gte: dayStart } },
      _sum: { points: true },
    });
    const used = todaySum._sum.points ?? 0;
    if (used >= levers.dailyPointCap) {
      const user = await getUserGamificationDb(input.userId);
      return { awarded: false, totalPoints: user.totalPoints, pointsEarned: 0 };
    }
    // Truncate points to remaining cap
    const remaining = levers.dailyPointCap - used;
    if (input.points > remaining) {
      input = { ...input, points: remaining };
    }
  }

  const seasonKey = currentSeasonKey(levers.seasonDays);
  const at = new Date();

  try {
    await prisma.gamificationEvent.create({
      data: {
        id: input.eventId,
        userId: input.userId,
        type: input.type,
        points: input.points,
        label: input.label || input.type,
        at,
        programSlug: input.programSlug ?? null,
        seasonKey,
      },
    });
  } catch (e: unknown) {
    // Unique race
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) {
      const user = await getUserGamificationDb(input.userId);
      return { awarded: false, totalPoints: user.totalPoints, pointsEarned: 0 };
    }
    throw e;
  }

  // Refresh season score
  let division = divisionForPlan("explorer");
  try {
    const profile = await getMemberProfile(input.userId);
    division = divisionForPlan(profile?.plan);
  } catch {
    /* ignore */
  }
  try {
    await recomputeUserSeasonScore(input.userId, division, levers);
  } catch (e) {
    console.error("recomputeUserSeasonScore", e);
  }

  const user = await getUserGamificationDb(input.userId);
  return { awarded: true, totalPoints: user.totalPoints, pointsEarned: input.points };
}

export async function awardGamificationPoints(input: {
  userId: string;
  eventId: string;
  type: GamificationEventType;
  label?: string;
  points?: number;
  programSlug?: string | null;
}): Promise<{ awarded: boolean; totalPoints: number; pointsEarned: number }> {
  const pointsConfig = await getGamificationPointsConfig();
  const points = input.points ?? pointsConfig[input.type];

  if (isDatabaseConfigured()) {
    try {
      return await awardDb({ ...input, points });
    } catch (e) {
      console.error("awardGamificationPoints db", e);
      // fall through to blob for resilience in misconfigured envs
    }
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const store =
      attempt === 0 ? await getStore({ preferFresh: true }) : await getStore();
    const current = normalizeUser(store[input.userId], input.userId);

    if (current.events.some((e) => e.id === input.eventId)) {
      return { awarded: false, totalPoints: current.totalPoints, pointsEarned: 0 };
    }

    const event: GamificationEvent = {
      id: input.eventId,
      type: input.type,
      points,
      label: input.label || input.type,
      at: new Date().toISOString(),
      programSlug: input.programSlug ?? null,
    };

    const events = [...current.events, event];
    const next: UserGamification = {
      userId: input.userId,
      totalPoints: sumEventPoints(events),
      events,
      updatedAt: new Date().toISOString(),
    };

    const updatedStore: GamificationStore = { ...store, [input.userId]: next };
    const { blobSaved } = await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: updatedStore,
      setMemory: (v) => {
        memoryStore = v as GamificationStore;
      },
    });

    if (!blobSaved && attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      continue;
    }
    requireBlobPersisted(blobSaved, "Gamification points");

    if (userHasEvent(input.userId, input.eventId)) {
      const verified = normalizeUser(memoryStore?.[input.userId], input.userId);
      return { awarded: true, totalPoints: verified.totalPoints, pointsEarned: points };
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      continue;
    }
  }

  throw new Error("Could not save gamification points — please try again in a moment.");
}
