import "server-only";

import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { readLocalJson, writeLocalJson } from "@/lib/demo-json-blob";
import {
  deletePendingStateDb,
  deletePendingStatesForCoachDb,
  loadPendingStatesFromDb,
  upsertPendingStateDb,
} from "@/lib/zoom-oauth-pending-db";

export type ZoomOAuthPending = {
  coachEmail: string;
  createdAt: string;
};

type PendingMap = Record<string, ZoomOAuthPending>;

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

async function loadMapFromDevFile(): Promise<PendingMap> {
  const fromDisk = readLocalJson<PendingMap>(DEV_FILE) || {};
  memoryStore = prune(fromDisk);
  return memoryStore;
}

async function saveMapToDevFile(map: PendingMap): Promise<void> {
  const pruned = prune(map);
  memoryStore = pruned;
  writeLocalJson(DEV_FILE, pruned);
}

async function loadMap(): Promise<PendingMap> {
  if (!isDemoMode()) {
    memoryStore = prune(await loadPendingStatesFromDb());
    return memoryStore;
  }
  return loadMapFromDevFile();
}

async function saveMap(map: PendingMap): Promise<void> {
  const pruned = prune(map);
  memoryStore = pruned;

  if (!isDemoMode()) {
    const existing = await loadPendingStatesFromDb();
    const nextKeys = new Set(Object.keys(pruned));
    for (const key of Object.keys(existing)) {
      if (!nextKeys.has(key)) await deletePendingStateDb(key);
    }
    for (const [state, pending] of Object.entries(pruned)) {
      await upsertPendingStateDb(state, pending);
    }
    return;
  }

  await saveMapToDevFile(pruned);
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
  const email = normalizeCoachEmail(coachEmail);

  if (!isDemoMode()) {
    await deletePendingStatesForCoachDb(email);
    await upsertPendingStateDb(state, {
      coachEmail: email,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const map = await loadMap();
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
  const email = normalizeCoachEmail(coachEmail);
  const normalizedState = normalizeOAuthState(state);

  if (!isDemoMode()) {
    const map = await loadPendingStatesFromDb();
    const key = map[normalizedState] ? normalizedState : map[state] ? state : null;
    if (!key) return false;
    const pending = map[key];
    if (!pending || normalizeCoachEmail(pending.coachEmail) !== email) return false;
    await deletePendingStateDb(key);
    return true;
  }

  const map = await loadMap();
  const key = map[normalizedState] ? normalizedState : map[state] ? state : null;
  if (!key) return false;
  const pending = map[key];
  if (!pending || normalizeCoachEmail(pending.coachEmail) !== email) return false;
  delete map[key];
  await saveMap(map);
  return true;
}