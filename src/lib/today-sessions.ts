import path from "path";
import { randomUUID } from "crypto";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { buildWorkoutFromParsedSms } from "@/lib/sms-generated-workouts";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

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

export async function hydrateTodaySessions(): Promise<TodaySessionStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
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
  const sessions = listTodaySessions().filter((s) => sessionAppliesToUser(s, userId));
  if (sessions.length === 0) return null;

  const todayKey = referenceDate.toISOString().slice(0, 10);
  const onToday = sessions
    .filter((s) => s.sessionDate === todayKey)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  if (onToday.length > 0) return onToday[0];

  const now = referenceDate.getTime();
  const upcoming = sessions
    .filter((s) => new Date(s.scheduledAt).getTime() >= now - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return upcoming[0] ?? sessions[sessions.length - 1];
}

export function getUpcomingSessionsForUser(userId: string, referenceDate = new Date()): TodaySession[] {
  const now = referenceDate.getTime();
  return listTodaySessions()
    .filter((s) => sessionAppliesToUser(s, userId))
    .filter((s) => new Date(s.scheduledAt).getTime() >= now - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
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
}) {
  await hydrateTodaySessions();
  const parsed = parseSmsWorkout(input.rawSms);
  const { workoutId } = await buildWorkoutFromParsedSms(parsed);
  const userIds = input.userIds?.length ? input.userIds : [];
  const assignKey = userIdsKey(userIds);

  const store = readStore();
  const existing = Object.values(store.sessions).find(
    (s) => s.sessionDate === input.sessionDate && userIdsKey(s.userIds) === assignKey,
  );

  const session: TodaySession = {
    id: existing?.id || `today-${input.sessionDate}-${randomUUID().slice(0, 8)}`,
    sessionDate: input.sessionDate,
    scheduledAt: input.scheduledAt,
    title: input.title || parsed.title,
    rawSms: input.rawSms,
    workoutId,
    programSlug: input.programSlug || "adult",
    userIds,
    replacesSchedule: input.replacesSchedule ?? true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    createdBy: input.createdBy,
  };

  store.sessions[session.id] = session;
  await writeStore(store);
  return { session, parsed, workoutId };
}

export async function deleteTodaySession(sessionIdOrDate: string) {
  await hydrateTodaySessions();
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