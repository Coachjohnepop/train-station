import path from "path";
import { randomUUID } from "crypto";
import { isDemoMode } from "@/lib/demo-enrollments";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import {
  buildWorkoutFromParsedSms,
  updateWorkoutRestTimer,
  type WorkoutRestTimerSettings,
} from "@/lib/sms-generated-workouts";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { localTodayIso } from "@/lib/program-calendar";
import {
  deleteSessionFromDb,
  deleteSessionsForUserOnDateDb,
  loadSessionsFromDb,
  upsertSessionDb,
} from "@/lib/today-sessions-db";

export type TodaySession = {
  id: string;
  sessionDate: string; // YYYY-MM-DD
  scheduledAt: string; // ISO datetime
  title: string;
  rawSms: string;
  workoutId: string;
  programSlug: string;
  userIds: string[];
  replacesSchedule: boolean;
  createdAt: string;
  createdBy?: string;
};

type TodaySessionStore = {
  sessions: Record<string, TodaySession>;
};

const DEV_FILE = path.join(process.cwd(), "prisma", "today-sessions.dev.json");
const BLOB_PATH = "demo/today-sessions.json";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

let memoryStore: TodaySessionStore | null = null;

function emptyStore(): TodaySessionStore {
  return { sessions: {} };
}

function setMemory(store: TodaySessionStore) {
  memoryStore = store;
}

/** Migrate legacy date-keyed map (one session per day) to id-keyed map (many per day). */
function normalizeStore(raw: unknown): TodaySessionStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const sessions = (raw as TodaySessionStore).sessions;
  if (!sessions || typeof sessions !== "object") return emptyStore();

  const keys = Object.keys(sessions);
  if (keys.length === 0) return emptyStore();

  const first = sessions[keys[0] as keyof typeof sessions] as TodaySession;
  const legacyDateKeys = keys.every((k) => DATE_KEY_RE.test(k));
  const legacyMissingIds = first && !first.id;

  if (legacyDateKeys || legacyMissingIds) {
    const out: Record<string, TodaySession> = {};
    for (const [key, session] of Object.entries(sessions)) {
      const s = session as TodaySession;
      const id = s.id || `today-${key}`;
      out[id] = { ...s, id };
    }
    return { sessions: out };
  }

  return { sessions: sessions as Record<string, TodaySession> };
}

export async function hydrateTodaySessions(opts?: {
  preferFresh?: boolean;
}): Promise<TodaySessionStore> {
  if (!isDemoMode()) {
    const store = await loadSessionsFromDb();
    setMemory(store);
    return store;
  }

  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
    preferFresh: opts?.preferFresh,
  });
  const normalized = normalizeStore(hydrated);
  const rawSessions = (hydrated as TodaySessionStore)?.sessions ?? {};
  const needsMigration = Object.keys(rawSessions).some((k) => DATE_KEY_RE.test(k));
  if (needsMigration) {
    setMemory(normalized);
    await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: normalized,
      setMemory,
    });
  }
  return normalized;
}

function readStore(): TodaySessionStore {
  if (memoryStore) return memoryStore;
  const fromDisk = readLocalJson<unknown>(DEV_FILE);
  memoryStore = normalizeStore(fromDisk);
  return memoryStore;
}

async function writeStore(store: TodaySessionStore) {
  if (!isDemoMode()) {
    setMemory(store);
    for (const session of Object.values(store.sessions)) {
      await upsertSessionDb(session);
    }
    return;
  }

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

/** Write one class row first so a slow rest-timer rewrite cannot drop the publish. */
async function persistSessionAndCleanup(
  store: TodaySessionStore,
  session: TodaySession,
  emptiedIds: string[],
) {
  store.sessions[session.id] = session;
  setMemory(store);
  if (!isDemoMode()) {
    await upsertSessionDb(session);
    for (const id of emptiedIds) {
      await deleteSessionFromDb(id);
    }
    return;
  }
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
}

async function applyRestTimerAfterSave(
  workoutId: string,
  restTimer: WorkoutRestTimerSettings | undefined,
  alreadyApplied: boolean,
) {
  if (!restTimer || alreadyApplied) return;
  try {
    await updateWorkoutRestTimer(workoutId, restTimer);
  } catch (err) {
    console.error("class saved; rest timer update failed", err);
  }
}

function userIdsKey(userIds: string[]) {
  return [...userIds].sort().join(",");
}

export function listTodaySessions(): TodaySession[] {
  return Object.values(readStore().sessions).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

/** @deprecated Prefer getSessionsForDate — returns earliest session on that date if any exist. */
export function getTodaySessionByDate(sessionDate: string): TodaySession | null {
  const onDate = getSessionsForDate(sessionDate);
  return onDate[0] ?? null;
}

export function getSessionsForDate(sessionDate: string): TodaySession[] {
  return listTodaySessions()
    .filter((s) => s.sessionDate === sessionDate)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export function getSessionForUserOnDate(userId: string, sessionDate: string): TodaySession | null {
  // Prefer the most recently created assignment when a member was left on
  // multiple sessions (legacy bug). Deploy paths now detach first.
  const matches = getSessionsForDate(sessionDate)
    .filter((s) => s.userIds.includes(userId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return matches[0] ?? null;
}

/**
 * Remove members from every class session on a date except `keepSessionId`.
 * Deletes sessions that end up with zero members. Required for mid-class
 * replace so the new plan is the only assignment.
 */
export function detachUsersFromSessionsOnDate(
  store: TodaySessionStore,
  userIds: string[],
  sessionDate: string,
  keepSessionId?: string,
): { emptiedSessionIds: string[] } {
  const targets = new Set(userIds);
  if (targets.size === 0) return { emptiedSessionIds: [] };

  const emptiedSessionIds: string[] = [];
  for (const session of Object.values(store.sessions)) {
    if (session.sessionDate !== sessionDate) continue;
    if (keepSessionId && session.id === keepSessionId) continue;
    if (!session.userIds.some((id) => targets.has(id))) continue;

    session.userIds = session.userIds.filter((id) => !targets.has(id));
    if (session.userIds.length === 0) {
      emptiedSessionIds.push(session.id);
      delete store.sessions[session.id];
    } else {
      store.sessions[session.id] = session;
    }
  }
  return { emptiedSessionIds };
}

function sessionAppliesToUser(session: TodaySession, userId: string) {
  return session.userIds.length > 0 && session.userIds.includes(userId);
}

export function getTodaySessionForUser(userId: string, referenceDate = new Date()): TodaySession | null {
  const todayKey = localTodayIso(referenceDate);
  return getSessionForUserOnDate(userId, todayKey);
}

export function getUpcomingSessionsForUser(userId: string, referenceDate = new Date()): TodaySession[] {
  const now = referenceDate.getTime();
  return listTodaySessions()
    .filter((s) => sessionAppliesToUser(s, userId))
    .filter((s) => new Date(s.scheduledAt).getTime() >= now - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

function normalizePlanText(rawSms: string) {
  return rawSms.trim().replace(/\r\n/g, "\n");
}

function findSessionWithPlanOnDate(sessionDate: string, rawSms: string, store = readStore()) {
  const key = normalizePlanText(rawSms);
  return (
    Object.values(store.sessions).find(
      (s) => s.sessionDate === sessionDate && normalizePlanText(s.rawSms) === key,
    ) ?? null
  );
}

export async function createTodaySessionFromSms(input: {
  sessionDate: string;
  scheduledAt: string;
  rawSms: string;
  programSlug?: string;
  userIds?: string[];
  replacesSchedule?: boolean;
  createdBy?: string;
  title?: string;
  /** Skip rebuild when the coach is republishing a saved class plan. */
  workoutId?: string;
  restTimer?: WorkoutRestTimerSettings;
  /**
   * When true (default), pull members off any other class that day so the
   * new plan is the only active assignment — needed mid-live replace.
   */
  replaceExisting?: boolean;
}) {
  await hydrateTodaySessions();
  const rawSms = input.rawSms.trim();
  const userIds = input.userIds?.length ? input.userIds : [];
  const parsed = parseSmsWorkout(rawSms);
  const replaceExisting = input.replaceExisting !== false;

  const store = readStore();
  const samePlan = findSessionWithPlanOnDate(input.sessionDate, rawSms, store);

  let workoutId = input.workoutId || samePlan?.workoutId;
  let newExerciseIds: string[] = [];

  let restAlreadyOnWorkout = false;
  if (!workoutId) {
    const built = await buildWorkoutFromParsedSms(parsed, undefined, input.restTimer);
    workoutId = built.workoutId;
    newExerciseIds = built.newExerciseIds;
    restAlreadyOnWorkout = Boolean(input.restTimer);
  }

  // Mid-live replace: members must leave their previous class session first.
  // Keep the matching plan row (if any) so we can update it in place.
  const emptiedBefore: string[] = [];
  if (replaceExisting && userIds.length > 0) {
    const { emptiedSessionIds } = detachUsersFromSessionsOnDate(
      store,
      userIds,
      input.sessionDate,
      samePlan?.id,
    );
    emptiedBefore.push(...emptiedSessionIds);
  }

  if (samePlan && store.sessions[samePlan.id]) {
    const current = store.sessions[samePlan.id];
    const mergedIds = [...new Set([...current.userIds, ...userIds])];
    const session: TodaySession = {
      ...current,
      scheduledAt: input.scheduledAt,
      title: input.title || current.title || parsed.title,
      rawSms,
      workoutId,
      userIds: mergedIds,
      replacesSchedule: input.replacesSchedule ?? current.replacesSchedule,
      createdBy: input.createdBy ?? current.createdBy,
      // Bump createdAt so member poll + "latest assignment" prefer this push.
      createdAt: new Date().toISOString(),
    };
    await persistSessionAndCleanup(store, session, emptiedBefore);
    await applyRestTimerAfterSave(workoutId, input.restTimer, restAlreadyOnWorkout);
    return {
      session,
      parsed,
      workoutId,
      newExerciseIds,
      reused: true as const,
      replaced: true as const,
    };
  }

  const assignKey = userIdsKey(userIds);
  const existing = Object.values(store.sessions).find(
    (s) => s.sessionDate === input.sessionDate && userIdsKey(s.userIds) === assignKey,
  );

  const session: TodaySession = {
    id: existing?.id || `today-${input.sessionDate}-${randomUUID().slice(0, 8)}`,
    sessionDate: input.sessionDate,
    scheduledAt: input.scheduledAt,
    title: input.title || parsed.title,
    rawSms,
    workoutId,
    programSlug: input.programSlug || "adult",
    userIds,
    replacesSchedule: input.replacesSchedule ?? true,
    // Always stamp now so live clients detect the push even if workoutId is unchanged.
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  await persistSessionAndCleanup(store, session, emptiedBefore);
  await applyRestTimerAfterSave(workoutId, input.restTimer, restAlreadyOnWorkout);
  return {
    session,
    parsed,
    workoutId,
    newExerciseIds,
    reused: false as const,
    replaced: replaceExisting && userIds.length > 0,
  };
}

export async function deleteTodaySession(sessionIdOrDate: string) {
  await hydrateTodaySessions({ preferFresh: true });
  const store = readStore();
  if (store.sessions[sessionIdOrDate]) {
    delete store.sessions[sessionIdOrDate];
    if (!isDemoMode()) {
      await deleteSessionFromDb(sessionIdOrDate);
      setMemory(store);
      return true;
    }
    await writeStore(store);
    return true;
  }
  const onDate = Object.values(store.sessions).filter((s) => s.sessionDate === sessionIdOrDate);
  if (onDate.length === 0) return false;
  for (const s of onDate) {
    delete store.sessions[s.id];
    if (!isDemoMode()) {
      await deleteSessionFromDb(s.id);
    }
  }
  if (!isDemoMode()) {
    setMemory(store);
    return true;
  }
  await writeStore(store);
  return true;
}

export function getTodaySessionById(sessionId: string): TodaySession | null {
  return readStore().sessions[sessionId] ?? null;
}

/** Add a member to an existing session (cascade — same workout for more students). */
export async function addMemberToTodaySession(
  sessionId: string,
  userId: string,
  opts?: { preferFresh?: boolean; replaceExisting?: boolean },
) {
  await hydrateTodaySessions(opts?.preferFresh ? { preferFresh: true } : undefined);
  const store = readStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("Session not found");
  if (session.userIds.includes(userId)) {
    return { session, alreadyAssigned: true as const };
  }
  const emptied: string[] = [];
  if (opts?.replaceExisting !== false) {
    const result = detachUsersFromSessionsOnDate(
      store,
      [userId],
      session.sessionDate,
      sessionId,
    );
    emptied.push(...result.emptiedSessionIds);
  }
  const target = store.sessions[sessionId];
  if (!target) throw new Error("Session not found");
  target.userIds = [...target.userIds, userId];
  target.createdAt = new Date().toISOString();
  store.sessions[sessionId] = target;
  await writeStore(store);
  if (!isDemoMode()) {
    for (const id of emptied) await deleteSessionFromDb(id);
  }
  return { session: target, alreadyAssigned: false as const };
}

/** Add several members in one hydrate/write — faster when publishing a saved class. */
export async function addMembersToTodaySession(
  sessionId: string,
  userIds: string[],
  opts?: { replaceExisting?: boolean },
) {
  await hydrateTodaySessions();
  const store = readStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("Session not found");

  const replaceExisting = opts?.replaceExisting !== false;
  const added: string[] = [];
  const skipped: string[] = [];
  const toAttach = userIds.filter((userId) => {
    if (session.userIds.includes(userId)) {
      skipped.push(userId);
      return false;
    }
    return true;
  });

  const emptied: string[] = [];
  if (replaceExisting && toAttach.length > 0) {
    const result = detachUsersFromSessionsOnDate(
      store,
      toAttach,
      session.sessionDate,
      sessionId,
    );
    emptied.push(...result.emptiedSessionIds);
  }

  const target = store.sessions[sessionId];
  if (!target) throw new Error("Session not found");
  for (const userId of toAttach) {
    if (!target.userIds.includes(userId)) {
      target.userIds.push(userId);
      added.push(userId);
    }
  }

  if (added.length > 0) {
    target.createdAt = new Date().toISOString();
    store.sessions[sessionId] = target;
    await writeStore(store);
  }
  if (!isDemoMode()) {
    for (const id of emptied) await deleteSessionFromDb(id);
  }

  return { session: target, added, skipped };
}

/** Copy one student's workout to others on the same day (joins shared session). */
export async function cascadeWorkoutFromMember(input: {
  sessionDate: string;
  sourceUserId: string;
  targetUserIds: string[];
  /** When true (default), move members off a different plan onto this one. */
  replaceExisting?: boolean;
}) {
  await hydrateTodaySessions();
  const source = getSessionForUserOnDate(input.sourceUserId, input.sessionDate);
  if (!source) throw new Error("Source student has no workout for this day");

  const targets = input.targetUserIds.filter((userId) => userId !== input.sourceUserId);
  const batch = await addMembersToTodaySession(source.id, targets, {
    replaceExisting: input.replaceExisting !== false,
  });

  const session = getTodaySessionById(source.id)!;
  return { session, added: batch.added, skipped: batch.skipped };
}

/** Assign an open student to the day's most-used workout (largest group). */
export async function addMemberToPrimarySession(sessionDate: string, userId: string) {
  const sessions = getSessionsForDate(sessionDate).filter((s) => s.userIds.length > 0);
  if (sessions.length === 0) throw new Error("No workouts on this day yet — build one first");

  const primary = [...sessions].sort((a, b) => b.userIds.length - a.userIds.length)[0];
  return addMemberToTodaySession(primary.id, userId);
}

/** Remove sessions on a date assigned to a specific member (leaves other sessions on that day). */
export async function deleteSessionForUserOnDate(userId: string, sessionDate: string) {
  await hydrateTodaySessions({ preferFresh: true });
  if (!isDemoMode()) {
    const ok = await deleteSessionsForUserOnDateDb(userId, sessionDate);
    if (ok) {
      const store = readStore();
      for (const [id, s] of Object.entries(store.sessions)) {
        if (s.sessionDate === sessionDate && s.userIds.includes(userId)) {
          delete store.sessions[id];
        }
      }
      setMemory(store);
    }
    return ok;
  }

  const store = readStore();
  const toDelete = Object.values(store.sessions).filter(
    (s) => s.sessionDate === sessionDate && s.userIds.includes(userId),
  );
  if (toDelete.length === 0) return false;
  for (const s of toDelete) delete store.sessions[s.id];
  await writeStore(store);
  return true;
}