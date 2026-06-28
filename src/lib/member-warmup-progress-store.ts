import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type WarmupProgressEntry = {
  userId: string;
  sessionDate: string;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  coachNotifiedAt: string | null;
  updatedAt: string;
};

type ProgressStore = Record<string, WarmupProgressEntry>;

const BLOB_PATH = "demo/member-warmup-progress.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-warmup-progress.dev.json");

let memoryStore: ProgressStore | null = null;

function progressKey(userId: string, sessionDate: string): string {
  return `${userId}::${sessionDate}`;
}

function normalizeEntry(raw: unknown, userId: string, sessionDate: string): WarmupProgressEntry {
  if (!raw || typeof raw !== "object") {
    return {
      userId,
      sessionDate,
      completedSets: {},
      finishedExercises: [],
      coachNotifiedAt: null,
      updatedAt: new Date().toISOString(),
    };
  }
  const data = raw as Partial<WarmupProgressEntry>;
  const completedSets: Record<string, number[]> = {};
  if (data.completedSets && typeof data.completedSets === "object") {
    for (const [k, v] of Object.entries(data.completedSets)) {
      if (Array.isArray(v)) completedSets[k] = v.filter((n) => typeof n === "number");
    }
  }
  return {
    userId,
    sessionDate,
    completedSets,
    finishedExercises: Array.isArray(data.finishedExercises)
      ? data.finishedExercises.filter((x) => typeof x === "string")
      : [],
    coachNotifiedAt: data.coachNotifiedAt ?? null,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<ProgressStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as ProgressStore) || {};
    },
    fallback: () => ({}),
  });
  memoryStore = hydrated as ProgressStore;
  return memoryStore;
}

export async function getWarmupProgress(
  userId: string,
  sessionDate: string,
): Promise<WarmupProgressEntry> {
  const store = await getStore();
  const key = progressKey(userId, sessionDate);
  return normalizeEntry(store[key], userId, sessionDate);
}

export async function saveWarmupProgress(input: {
  userId: string;
  sessionDate: string;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  coachNotifiedAt?: string | null;
}): Promise<WarmupProgressEntry> {
  const store = await getStore();
  const key = progressKey(input.userId, input.sessionDate);
  const current = normalizeEntry(store[key], input.userId, input.sessionDate);
  const next: WarmupProgressEntry = {
    ...current,
    completedSets: input.completedSets,
    finishedExercises: input.finishedExercises,
    coachNotifiedAt:
      input.coachNotifiedAt !== undefined ? input.coachNotifiedAt : current.coachNotifiedAt,
    updatedAt: new Date().toISOString(),
  };
  store[key] = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as ProgressStore;
    },
  });
  return next;
}

export function warmupHasActivity(entry: WarmupProgressEntry): boolean {
  const setCount = Object.values(entry.completedSets).reduce((n, arr) => n + arr.length, 0);
  return setCount > 0 || entry.finishedExercises.length > 0;
}