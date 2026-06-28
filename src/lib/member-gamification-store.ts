import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
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
  const totalFromEvents = events.reduce((sum, e) => sum + e.points, 0);
  return {
    userId,
    totalPoints:
      typeof data.totalPoints === "number" ? data.totalPoints : totalFromEvents,
    events,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<GamificationStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as GamificationStore) || {};
    },
    fallback: () => ({}),
  });
  memoryStore = hydrated as GamificationStore;
  return memoryStore;
}

export async function getUserGamification(userId: string): Promise<UserGamification> {
  const store = await getStore();
  return normalizeUser(store[userId], userId);
}

export async function listAllGamification(): Promise<UserGamification[]> {
  const store = await getStore();
  return Object.entries(store).map(([userId, raw]) => normalizeUser(raw, userId));
}

export async function awardGamificationPoints(input: {
  userId: string;
  eventId: string;
  type: GamificationEventType;
  label?: string;
  points?: number;
  programSlug?: string | null;
}): Promise<{ awarded: boolean; totalPoints: number }> {
  const store = await getStore();
  const current = normalizeUser(store[input.userId], input.userId);

  if (current.events.some((e) => e.id === input.eventId)) {
    return { awarded: false, totalPoints: current.totalPoints };
  }

  const points = input.points ?? GAMIFICATION_POINTS[input.type];
  const event: GamificationEvent = {
    id: input.eventId,
    type: input.type,
    points,
    label: input.label || input.type,
    at: new Date().toISOString(),
    programSlug: input.programSlug ?? null,
  };

  const next: UserGamification = {
    userId: input.userId,
    totalPoints: current.totalPoints + points,
    events: [...current.events, event],
    updatedAt: new Date().toISOString(),
  };

  store[input.userId] = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as GamificationStore;
    },
  });

  return { awarded: true, totalPoints: next.totalPoints };
}