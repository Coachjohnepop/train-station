import "server-only";

import path from "path";
import { hydrateJsonStore, isBlobConfigured, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import {
  GAMIFICATION_POINTS,
  type GamificationEvent,
  type GamificationEventType,
  type UserGamification,
} from "@/lib/gamification-types";

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

export async function getUserGamification(userId: string): Promise<UserGamification> {
  const store = await getStore({ preferFresh: preferFreshReads() });
  return normalizeUser(store[userId], userId);
}

export async function listAllGamification(): Promise<UserGamification[]> {
  const store = await getStore({ preferFresh: preferFreshReads() });
  return Object.entries(store).map(([userId, raw]) => normalizeUser(raw, userId));
}

export async function removeGamificationForUsers(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
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

export async function awardGamificationPoints(input: {
  userId: string;
  eventId: string;
  type: GamificationEventType;
  label?: string;
  points?: number;
  programSlug?: string | null;
}): Promise<{ awarded: boolean; totalPoints: number }> {
  const points = input.points ?? GAMIFICATION_POINTS[input.type];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    // Only cold-start with a fresh blob read; retries must not overwrite memory with stale CDN data.
    const store =
      attempt === 0 ? await getStore({ preferFresh: true }) : await getStore();
    const current = normalizeUser(store[input.userId], input.userId);

    if (current.events.some((e) => e.id === input.eventId)) {
      return { awarded: false, totalPoints: current.totalPoints };
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

    // Trust instance memory immediately after persist — never re-verify via preferFresh blob reads.
    if (userHasEvent(input.userId, input.eventId)) {
      const verified = normalizeUser(memoryStore?.[input.userId], input.userId);
      return { awarded: true, totalPoints: verified.totalPoints };
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      continue;
    }
  }

  throw new Error("Could not save gamification points — please try again in a moment.");
}