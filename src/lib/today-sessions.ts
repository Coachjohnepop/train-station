import fs from "fs";
import path from "path";
import { parseSmsWorkout } from "@/lib/sms-workout-parser";
import { buildWorkoutFromParsedSms } from "@/lib/sms-generated-workouts";

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

let memoryStore: TodaySessionStore | null = null;

function emptyStore(): TodaySessionStore {
  return { sessions: {} };
}

function readStore(): TodaySessionStore {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(DEV_FILE)) {
      memoryStore = JSON.parse(fs.readFileSync(DEV_FILE, "utf8")) as TodaySessionStore;
      return memoryStore;
    }
  } catch (e) {
    console.warn("Could not read today-sessions.dev.json", e);
  }
  memoryStore = emptyStore();
  return memoryStore;
}

function writeStore(store: TodaySessionStore) {
  memoryStore = store;
  try {
    fs.writeFileSync(DEV_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    // Vercel/serverless: filesystem is read-only — in-memory cache still works per instance
    console.warn("Could not persist today-sessions.dev.json (using in-memory)", e);
  }
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

export function getTodaySessionForUser(userId: string, referenceDate = new Date()): TodaySession | null {
  const sessions = listTodaySessions().filter(
    (s) => s.userIds.length === 0 || s.userIds.includes(userId),
  );
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

export function createTodaySessionFromSms(input: {
  sessionDate: string;
  scheduledAt: string;
  rawSms: string;
  programSlug?: string;
  userIds?: string[];
  replacesSchedule?: boolean;
  createdBy?: string;
  title?: string;
}) {
  const parsed = parseSmsWorkout(input.rawSms);
  const { workoutId } = buildWorkoutFromParsedSms(parsed);

  const session: TodaySession = {
    id: `today-${input.sessionDate}`,
    sessionDate: input.sessionDate,
    scheduledAt: input.scheduledAt,
    title: input.title || parsed.title,
    rawSms: input.rawSms,
    workoutId,
    programSlug: input.programSlug || "adult",
    userIds: input.userIds || [],
    replacesSchedule: input.replacesSchedule ?? true,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  const store = readStore();
  store.sessions[input.sessionDate] = session;
  writeStore(store);
  return { session, parsed, workoutId };
}

export function deleteTodaySession(sessionDate: string) {
  const store = readStore();
  if (!store.sessions[sessionDate]) return false;
  delete store.sessions[sessionDate];
  writeStore(store);
  return true;
}