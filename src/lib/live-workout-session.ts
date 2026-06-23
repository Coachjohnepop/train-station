import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { localTodayIso } from "@/lib/program-calendar";
import { getHotLiveSession, setHotLiveSession } from "@/lib/live-session-hot";

export type LiveWorkoutSession = {
  userId: string;
  workoutId: string;
  sessionDate: string;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  weights: Record<string, string>;
  activeId?: string;
  updatedAt: string;
  updatedBy: "coach" | "member";
  revision: number;
};

/** Always scope live sync to a calendar day so coach/member keys match. */
export function normalizeLiveSessionDate(sessionDate?: string): string {
  return sessionDate?.trim() || localTodayIso();
}

type LiveSessionStore = {
  sessions: Record<string, LiveWorkoutSession>;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "live-workout-sessions.dev.json");
const BLOB_PATH = "demo/live-workout-sessions.json";

let memoryStore: LiveSessionStore | null = null;

function emptyStore(): LiveSessionStore {
  return { sessions: {} };
}

function setMemory(store: LiveSessionStore) {
  memoryStore = store;
}

export function liveSessionKey(
  userId: string,
  workoutId: string,
  sessionDate?: string,
): string {
  const date = normalizeLiveSessionDate(sessionDate);
  return `${userId}:${workoutId}:${date}`;
}

function mergeCompletedSets(
  existing: Record<string, number[]>,
  incoming: Record<string, number[]>,
): Record<string, number[]> {
  const out = { ...existing };
  for (const [blockId, nums] of Object.entries(incoming)) {
    const merged = new Set([...(out[blockId] ?? []), ...nums]);
    out[blockId] = Array.from(merged).sort((a, b) => a - b);
  }
  return out;
}

function mergeFinishedExercises(existing: string[], incoming: string[]): string[] {
  if (incoming.length < existing.length) return incoming;
  return Array.from(new Set([...existing, ...incoming]));
}

async function loadStore(preferFresh = false): Promise<LiveSessionStore> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
    preferFresh,
  });
}

async function persistSessionToBlob(session: LiveWorkoutSession): Promise<boolean> {
  const key = liveSessionKey(session.userId, session.workoutId, session.sessionDate);
  const store = await loadStore(true);
  store.sessions[key] = session;
  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
  return blobSaved;
}

export async function getLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<LiveWorkoutSession | null> {
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  const hot = getHotLiveSession(key);
  if (hot) return hot;

  const store = await loadStore(true);
  const session = store.sessions[key] ?? null;
  if (session) setHotLiveSession(key, session);
  return session;
}

export async function upsertLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  weights: Record<string, string>;
  activeId?: string;
  updatedBy: "coach" | "member";
}): Promise<{ session: LiveWorkoutSession; blobSaved: boolean }> {
  const sessionDate = normalizeLiveSessionDate(input.sessionDate);
  const key = liveSessionKey(input.userId, input.workoutId, sessionDate);
  let existing = getHotLiveSession(key);
  if (!existing) {
    const store = await loadStore(true);
    existing = store.sessions[key] ?? null;
    if (existing) setHotLiveSession(key, existing);
  }
  const session: LiveWorkoutSession = {
    userId: input.userId,
    workoutId: input.workoutId,
    sessionDate,
    completedSets: mergeCompletedSets(existing?.completedSets ?? {}, input.completedSets),
    finishedExercises: mergeFinishedExercises(
      existing?.finishedExercises ?? [],
      input.finishedExercises,
    ),
    weights: { ...(existing?.weights ?? {}), ...input.weights },
    activeId: input.activeId ?? existing?.activeId,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    revision: (existing?.revision ?? 0) + 1,
  };

  setHotLiveSession(key, session);

  void persistSessionToBlob(session).catch((err) => {
    console.warn("live session blob persist failed", err);
  });

  return { session, blobSaved: true };
}

export async function clearLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<void> {
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  setHotLiveSession(key, null);

  const store = await loadStore(true);
  if (!store.sessions[key]) return;
  delete store.sessions[key];
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}