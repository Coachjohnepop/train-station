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

/** Shared rest/exercise popup so coach checkoff spins the same timer on the member. */
export type LiveRestActive = {
  blockId: string;
  completedSetNum: number;
  /** Epoch ms when countdown hits zero */
  endsAt: number;
  totalSeconds: number;
  startedBy: "coach" | "member";
  /**
   * exercise = hold / timed set ("Time of Exercise", green)
   * rest = between-sets rest (amber default)
   */
  phase?: "exercise" | "rest";
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

/**
 * Client sends a full snapshot of its completed-set map.
 * Blocks present in `incoming` replace existing (including empty arrays = uncheck all).
 * Blocks only on the server (not mentioned) are kept — concurrent partner progress.
 */
function mergeCompletedSets(
  existing: Record<string, number[]>,
  incoming: Record<string, number[]>,
): Record<string, number[]> {
  const out = { ...existing };
  for (const [blockId, nums] of Object.entries(incoming)) {
    // Replace — do not union. Unchecks must stick.
    out[blockId] = Array.from(new Set(nums)).sort((a, b) => a - b);
  }
  return out;
}

function mergeFinishedExercises(existing: string[], incoming: string[]): string[] {
  // Full replace from client snapshot so undoing "exercise done" can clear.
  if (Array.isArray(incoming)) return Array.from(new Set(incoming));
  return existing;
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

/**
 * Weights: non-empty values win. When both sides send non-empty for the same key,
 * prefer the writer's value (input). Empty strings never wipe a known weight.
 */
function mergeWeights(
  existing: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed === "") continue;
    out[k] = trimmed;
  }
  return out;
}

/**
 * Completed sets: replace per block when the writer includes that block.
 * If a stale member write races a newer coach write, union the set numbers so
 * coach checkoffs are not wiped (member can still uncheck by pushing empty array).
 */
function mergeCompletedSetsForWriter(
  existing: Record<string, number[]>,
  incoming: Record<string, number[]>,
  opts: { staleMemberVsCoach: boolean },
): Record<string, number[]> {
  if (!opts.staleMemberVsCoach) {
    return mergeCompletedSets(existing, incoming);
  }
  const out = { ...existing };
  for (const [blockId, nums] of Object.entries(incoming)) {
    const prev = new Set(out[blockId] ?? []);
    const next = new Set(nums);
    // If member cleared all sets intentionally, honor empty only when not racing coach.
    // Stale race: union so coach progress sticks.
    for (const n of next) prev.add(n);
    out[blockId] = Array.from(prev).sort((a, b) => a - b);
  }
  return out;
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
  /** Client's last known revision — used to detect stale overwrites. */
  baseRevision?: number;
}): Promise<{ session: LiveWorkoutSession; blobSaved: boolean }> {
  const sessionDate = normalizeLiveSessionDate(input.sessionDate);
  const key = liveSessionKey(input.userId, input.workoutId, sessionDate);
  // Prefer newer of hot vs durable so concurrent writers don't base on a stale rev.
  let existing = await getLiveWorkoutSession({
    userId: input.userId,
    workoutId: input.workoutId,
    sessionDate,
  });

  const existingRev = existing?.revision ?? 0;
  const baseRevision =
    typeof input.baseRevision === "number" && Number.isFinite(input.baseRevision)
      ? input.baseRevision
      : null;
  const staleMemberVsCoach =
    input.updatedBy === "member" &&
    existing?.updatedBy === "coach" &&
    baseRevision != null &&
    existingRev > baseRevision;

  // Rest duration/enabled: coach owns. Members must not clobber with defaults.
  let restTimerEnabled = existing?.restTimerEnabled;
  let restTimerSeconds = existing?.restTimerSeconds;
  let restTimerSound = existing?.restTimerSound;
  if (input.updatedBy === "coach") {
    if (typeof input.restTimerEnabled === "boolean") {
      restTimerEnabled = input.restTimerEnabled;
    }
    if (typeof input.restTimerSeconds === "number") {
      restTimerSeconds = input.restTimerSeconds;
    }
    if (typeof input.restTimerSound === "string" && input.restTimerSound.trim()) {
      restTimerSound = input.restTimerSound.trim();
    }
  } else if (restTimerEnabled === undefined && typeof input.restTimerEnabled === "boolean") {
    // First write, no coach yet — allow member to seed.
    restTimerEnabled = input.restTimerEnabled;
    if (typeof input.restTimerSeconds === "number") restTimerSeconds = input.restTimerSeconds;
    if (typeof input.restTimerSound === "string" && input.restTimerSound.trim()) {
      restTimerSound = input.restTimerSound.trim();
    }
  }

  // Rest popup: coach duration retargets and either side's skip must stick.
  // Critical: after coach/member clears (null), a late member poll-echo must NOT
  // revive the old endsAt — that made Skip look broken on the coach floor.
  let restActive: LiveRestActive | null;
  if (!input.restActiveProvided) {
    restActive = existing?.restActive ?? null;
  } else if (input.restActive == null) {
    // Explicit clear (skip / close) — both sides
    restActive = null;
  } else if (input.updatedBy === "coach") {
    restActive = input.restActive;
  } else {
    const prev = existing?.restActive ?? null;
    const next = input.restActive;
    if (!prev) {
      // Nothing active server-side. Member may start their own rest, but must not
      // resurrect a coach-started timer after a skip cleared it.
      if (next.startedBy === "coach") {
        restActive = null;
      } else {
        restActive = next;
      }
    } else if (
      prev.startedBy === "coach" &&
      next.startedBy === "coach" &&
      prev.blockId === next.blockId &&
      prev.completedSetNum === next.completedSetNum &&
      prev.endsAt !== next.endsAt
    ) {
      // Member echo of older endsAt — keep coach retarget
      restActive = prev;
    } else if (prev.startedBy === "coach" && next.startedBy === "member") {
      // Member cannot clobber an active coach timer (except via null clear above)
      restActive = prev;
    } else {
      restActive = next;
    }
  }

  // Stale member write racing coach: keep coach weights for keys coach set; still accept member keys.
  let weights: Record<string, string>;
  if (staleMemberVsCoach && existing) {
    weights = mergeWeights(input.weights, existing.weights);
  } else {
    weights = mergeWeights(existing?.weights ?? {}, input.weights);
  }

  const completedSets = mergeCompletedSetsForWriter(
    existing?.completedSets ?? {},
    input.completedSets,
    { staleMemberVsCoach },
  );

  const finishedExercises = staleMemberVsCoach
    ? Array.from(
        new Set([
          ...(existing?.finishedExercises ?? []),
          ...mergeFinishedExercises([], input.finishedExercises),
        ]),
      )
    : mergeFinishedExercises(
        existing?.finishedExercises ?? [],
        input.finishedExercises,
      );

  const session: LiveWorkoutSession = {
    userId: input.userId,
    workoutId: input.workoutId,
    sessionDate,
    completedSets,
    finishedExercises,
    weights,
    activeId: input.activeId ?? existing?.activeId,
    restTimerEnabled,
    restTimerSeconds,
    restTimerSound,
    restActive,
    updatedAt: new Date().toISOString(),
    // Keep coach as author when member stale-write merges onto coach state.
    updatedBy: staleMemberVsCoach ? "coach" : input.updatedBy,
    revision: existingRev + 1,
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