import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type ZoomOAuthPending = {
  coachEmail: string;
  createdAt: string;
};

type PendingMap = Record<string, ZoomOAuthPending>;

const BLOB_PATH = "coach/zoom-oauth-pending.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "zoom-oauth-pending.dev.json");
const TTL_MS = 15 * 60 * 1000;

let memoryStore: PendingMap = {};

function prune(map: PendingMap): PendingMap {
  const cutoff = Date.now() - TTL_MS;
  const next: PendingMap = {};
  for (const [key, value] of Object.entries(map)) {
    if (new Date(value.createdAt).getTime() >= cutoff) next[key] = value;
  }
  return next;
}

async function loadMap(): Promise<PendingMap> {
  const hydrated = await hydrateJsonStore<PendingMap>({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = prune(v || {});
    },
    fallback: () => ({}),
    preferFresh: true,
  });
  memoryStore = prune(hydrated || {});
  return memoryStore;
}

async function saveMap(map: PendingMap): Promise<void> {
  const pruned = prune(map);
  memoryStore = pruned;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: pruned,
    setMemory: (v) => {
      memoryStore = prune(v || {});
    },
  });
}

function normalizeCoachEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOAuthState(state: string): string {
  try {
    return decodeURIComponent(state).trim();
  } catch {
    return state.trim();
  }
}

export async function rememberZoomOAuthState(state: string, coachEmail: string): Promise<void> {
  const map = await loadMap();
  const email = normalizeCoachEmail(coachEmail);
  // One active Connect per coach — double-clicks were leaving stale states that failed callback.
  for (const [key, value] of Object.entries(map)) {
    if (normalizeCoachEmail(value.coachEmail) === email) delete map[key];
  }
  map[state] = { coachEmail: email, createdAt: new Date().toISOString() };
  await saveMap(map);
}

export async function consumeZoomOAuthState(
  state: string,
  coachEmail: string,
): Promise<boolean> {
  const map = await loadMap();
  const email = normalizeCoachEmail(coachEmail);
  const normalizedState = normalizeOAuthState(state);
  const key = map[normalizedState] ? normalizedState : map[state] ? state : null;
  if (!key) return false;
  const pending = map[key];
  if (!pending || normalizeCoachEmail(pending.coachEmail) !== email) return false;
  delete map[key];
  await saveMap(map);
  return true;
}