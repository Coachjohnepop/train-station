import path from "path";
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

let memoryStore: TodaySessionStore | null = null;

function emptyStore(): TodaySessionStore {
  return { sessions: {} };
}

function setMemory(store: TodaySessionStore) {
  memoryStore = store;
}

export async function hydrateTodaySessions(): Promise<TodaySessionStore> {
  return hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory,
    fallback: emptyStore,
  });
}

function readStore(): TodaySessionStore {
  if (memoryStore) return memoryStore;
  memoryStore = readLocalJson<TodaySessionStore>(DEV_FILE) || emptyStore();
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

export function listTodaySessions(): TodaySession[] {
  return Object.values(readStore().sessions).sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

export function getTodaySessionByDate(sessionDate: string): TodaySession | null {
  return readStore().sessions[sessionDate] ?? null;
}

export function getSessionsForDate(sessionDate: string): TodaySession[] {
  return listTodaySessions().filter((s) => s.sessionDate === sessionDate);
}

function sessionAppliesToUser(session: TodaySession, userId: string) {
  return session.userIds.length > 0 && session.userIds.includes(userId);
}

export function getTodaySessionForUser(userId: string, referenceDate = new Date()): TodaySession | null {
  const sessions = listTodaySessions().filter((s) => sessionAppliesToUser(s, userId));
  if (sessions.length === 0) return null;

  const todayKey = referenceDate.toISOString().slice(0, 10);
  const exact = sessions.find((s) => s.sessionDate === todayKey);
  if (exact) return exact;

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

  const session: TodaySession = {
    id: `today-${input.sessionDate}`,
    sessionDate: input.sessionDate,
    scheduledAt: input.scheduledAt,
    title: input.title || parsed.title,
    rawSms: input.rawSms,
    workoutId,
    programSlug: input.programSlug || "adult",
    userIds: input.userIds?.length ? input.userIds : [],
    replacesSchedule: input.replacesSchedule ?? true,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  const store = readStore();
  store.sessions[input.sessionDate] = session;
  await writeStore(store);
  return { session, parsed, workoutId };
}

export async function deleteTodaySession(sessionDate: string) {
  await hydrateTodaySessions();
  const store = readStore();
  if (!store.sessions[sessionDate]) return false;
  delete store.sessions[sessionDate];
  await writeStore(store);
  return true;
}