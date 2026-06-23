import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { localTodayIso } from "@/lib/program-calendar";

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

export async function getLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<LiveWorkoutSession | null> {
  const store = await loadStore(true);
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  return store.sessions[key] ?? null;
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
  const store = await loadStore(true);
  const sessionDate = normalizeLiveSessionDate(input.sessionDate);
  const key = liveSessionKey(input.userId, input.workoutId, sessionDate);
  const existing = store.sessions[key];
  const session: LiveWorkoutSession = {
    userId: input.userId,
    workoutId: input.workoutId,
    sessionDate,
    completedSets: input.completedSets,
    finishedExercises: input.finishedExercises,
    weights: input.weights,
    activeId: input.activeId,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    revision: (existing?.revision ?? 0) + 1,
  };
  store.sessions[key] = session;
  const { blobSaved } = await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
  return { session, blobSaved };
}

export async function clearLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<void> {
  const store = await loadStore(true);
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  if (!store.sessions[key]) return;
  delete store.sessions[key];
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}