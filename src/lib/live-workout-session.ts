import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  deleteLiveWorkoutSessionFromDb,
  getLiveWorkoutSessionFromDb,
  upsertLiveWorkoutSessionToDb,
} from "@/lib/live-workout-sessions-db";
import { getHotLiveSession, setHotLiveSession } from "@/lib/live-session-hot";
import { localTodayIso } from "@/lib/program-calendar";

/** Shared rest popup so coach checkoff spins the same timer on the member. */
export type LiveRestActive = {
  blockId: string;
  completedSetNum: number;
  /** Epoch ms when countdown hits zero */
  endsAt: number;
  totalSeconds: number;
  startedBy: "coach" | "member";
};

export type LiveWorkoutSession = {
  userId: string;
  workoutId: string;
  sessionDate: string;
  completedSets: Record<string, number[]>;
  finishedExercises: string[];
  weights: Record<string, string>;
  activeId?: string;
  /** Coach floor rest controls — mirrored so member uses the same countdown. */
  restTimerEnabled?: boolean;
  restTimerSeconds?: number;
  restTimerSound?: string;
  /** Active rest popup (both sides show the same countdown). */
  restActive?: LiveRestActive | null;
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

async function persistSession(session: LiveWorkoutSession): Promise<boolean> {
  if (!isDemoMode()) {
    await upsertLiveWorkoutSessionToDb(session);
    return true;
  }
  return persistSessionToBlob(session);
}

function pickNewerSession(
  a: LiveWorkoutSession | null,
  b: LiveWorkoutSession | null,
): LiveWorkoutSession | null {
  if (!a) return b;
  if (!b) return a;
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;
  // Same revision — prefer more recent updatedAt.
  return a.updatedAt >= b.updatedAt ? a : b;
}

export async function getLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<LiveWorkoutSession | null> {
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  const hot = getHotLiveSession(key);

  // Always reconcile with durable store so coach checkoffs on another instance
  // are not hidden behind a stale in-memory revision on this instance.
  let durable: LiveWorkoutSession | null = null;
  if (!isDemoMode()) {
    const sessionDate = normalizeLiveSessionDate(input.sessionDate);
    durable = await getLiveWorkoutSessionFromDb({
      userId: input.userId,
      workoutId: input.workoutId,
      sessionDate,
    });
  } else {
    const store = await loadStore(true);
    durable = store.sessions[key] ?? null;
  }

  const session = pickNewerSession(hot, durable);
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
  /** Coach-only: rest controls for this live session (member inherits). */
  restTimerEnabled?: boolean;
  restTimerSeconds?: number;
  restTimerSound?: string;
  /** When provided (including null), replaces shared rest popup state. */
  restActive?: LiveRestActive | null;
  restActiveProvided?: boolean;
  updatedBy: "coach" | "member";
}): Promise<{ session: LiveWorkoutSession; blobSaved: boolean }> {
  const sessionDate = normalizeLiveSessionDate(input.sessionDate);
  const key = liveSessionKey(input.userId, input.workoutId, sessionDate);
  // Prefer newer of hot vs durable so concurrent writers don't base on a stale rev.
  let existing = await getLiveWorkoutSession({
    userId: input.userId,
    workoutId: input.workoutId,
    sessionDate,
  });

  // Coach may push rest settings; members omit them so we keep the last coach values.
  const restTimerEnabled =
    typeof input.restTimerEnabled === "boolean"
      ? input.restTimerEnabled
      : existing?.restTimerEnabled;
  const restTimerSeconds =
    typeof input.restTimerSeconds === "number"
      ? input.restTimerSeconds
      : existing?.restTimerSeconds;
  const restTimerSound =
    typeof input.restTimerSound === "string" && input.restTimerSound.trim()
      ? input.restTimerSound.trim()
      : existing?.restTimerSound;
  const restActive = input.restActiveProvided
    ? input.restActive ?? null
    : (existing?.restActive ?? null);

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
    restTimerEnabled,
    restTimerSeconds,
    restTimerSound,
    restActive,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    revision: (existing?.revision ?? 0) + 1,
  };

  // Hot cache first so SSE subscribers on this instance get the checkoff immediately.
  setHotLiveSession(key, session);

  // Await durable write so the other device's poll (other serverless instance) can read it.
  let blobSaved = true;
  try {
    blobSaved = await persistSession(session);
  } catch (err) {
    console.warn("live session persist failed", err);
    blobSaved = false;
  }

  return { session, blobSaved };
}

export async function clearLiveWorkoutSession(input: {
  userId: string;
  workoutId: string;
  sessionDate?: string;
}): Promise<void> {
  const key = liveSessionKey(input.userId, input.workoutId, input.sessionDate);
  setHotLiveSession(key, null);

  if (!isDemoMode()) {
    await deleteLiveWorkoutSessionFromDb({
      userId: input.userId,
      workoutId: input.workoutId,
      sessionDate: normalizeLiveSessionDate(input.sessionDate),
    });
    return;
  }

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