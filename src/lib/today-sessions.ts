import path from "path";
import { randomUUID } from "crypto";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import {
  buildWorkoutFromParsedSms,
  updateWorkoutRestTimer,
  type WorkoutRestTimerSettings,
} from "@/lib/sms-generated-workouts";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { localTodayIso } from "@/lib/program-calendar";

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
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory,
  });
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
  return (
    getSessionsForDate(sessionDate).find((s) => s.userIds.includes(userId)) ?? null
  );
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
}) {
  await hydrateTodaySessions();
  const rawSms = input.rawSms.trim();
  const userIds = input.userIds?.length ? input.userIds : [];
  const parsed = parseSmsWorkout(rawSms);

  const store = readStore();
  const samePlan = findSessionWithPlanOnDate(input.sessionDate, rawSms, store);

  let workoutId = input.workoutId || samePlan?.workoutId;
  let newExerciseIds: string[] = [];

  if (!workoutId) {
    const built = await buildWorkoutFromParsedSms(parsed, undefined, input.restTimer);
    workoutId = built.workoutId;
    newExerciseIds = built.newExerciseIds;
  } else if (input.restTimer) {
    await updateWorkoutRestTimer(workoutId, input.restTimer);
  }

  if (samePlan) {
    const mergedIds = [...new Set([...samePlan.userIds, ...userIds])];
    const session: TodaySession = {
      ...samePlan,
      scheduledAt: input.scheduledAt,
      title: input.title || samePlan.title || parsed.title,
      workoutId,
      userIds: mergedIds,
      replacesSchedule: input.replacesSchedule ?? samePlan.replacesSchedule,
      createdBy: input.createdBy ?? samePlan.createdBy,
    };
    store.sessions[session.id] = session;
    await writeStore(store);
    return { session, parsed, workoutId, newExerciseIds, reused: true as const };
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
    createdAt: existing?.createdAt || new Date().toISOString(),
    createdBy: input.createdBy,
  };

  store.sessions[session.id] = session;
  await writeStore(store);
  return { session, parsed, workoutId, newExerciseIds, reused: false as const };
}

export async function deleteTodaySession(sessionIdOrDate: string) {
  await hydrateTodaySessions({ preferFresh: true });
  const store = readStore();
  if (store.sessions[sessionIdOrDate]) {
    delete store.sessions[sessionIdOrDate];
    await writeStore(store);
    return true;
  }
  const onDate = Object.values(store.sessions).filter((s) => s.sessionDate === sessionIdOrDate);
  if (onDate.length === 0) return false;
  for (const s of onDate) delete store.sessions[s.id];
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
  opts?: { preferFresh?: boolean },
) {
  await hydrateTodaySessions(opts?.preferFresh ? { preferFresh: true } : undefined);
  const store = readStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("Session not found");
  if (session.userIds.includes(userId)) {
    return { session, alreadyAssigned: true as const };
  }
  session.userIds = [...session.userIds, userId];
  await writeStore(store);
  return { session, alreadyAssigned: false as const };
}

/** Add several members in one hydrate/write — faster when publishing a saved class. */
export async function addMembersToTodaySession(sessionId: string, userIds: string[]) {
  await hydrateTodaySessions();
  const store = readStore();
  const session = store.sessions[sessionId];
  if (!session) throw new Error("Session not found");

  const added: string[] = [];
  const skipped: string[] = [];
  for (const userId of userIds) {
    if (session.userIds.includes(userId)) {
      skipped.push(userId);
      continue;
    }
    session.userIds.push(userId);
    added.push(userId);
  }

  if (added.length > 0) {
    await writeStore(store);
  }

  return { session, added, skipped };
}

/** Copy one student's workout to others on the same day (joins shared session). */
export async function cascadeWorkoutFromMember(input: {
  sessionDate: string;
  sourceUserId: string;
  targetUserIds: string[];
}) {
  await hydrateTodaySessions();
  const source = getSessionForUserOnDate(input.sourceUserId, input.sessionDate);
  if (!source) throw new Error("Source student has no workout for this day");

  const added: string[] = [];
  const skipped: string[] = [];

  const targets = input.targetUserIds.filter((userId) => userId !== input.sourceUserId);
  const eligible: string[] = [];
  for (const userId of targets) {
    const existing = getSessionForUserOnDate(userId, input.sessionDate);
    if (existing && existing.id !== source.id) {
      skipped.push(userId);
      continue;
    }
    eligible.push(userId);
  }

  if (eligible.length > 0) {
    const batch = await addMembersToTodaySession(source.id, eligible);
    added.push(...batch.added);
  }

  const session = getTodaySessionById(source.id)!;
  return { session, added, skipped };
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
  const store = readStore();
  const toDelete = Object.values(store.sessions).filter(
    (s) => s.sessionDate === sessionDate && s.userIds.includes(userId),
  );
  if (toDelete.length === 0) return false;
  for (const s of toDelete) delete store.sessions[s.id];
  await writeStore(store);
  return true;
}