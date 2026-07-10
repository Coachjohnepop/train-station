import "server-only";

import path from "path";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  getMemberCoachPrefsFromDb,
  loadMemberCoachPrefsMapFromDb,
  persistMemberCoachPrefsToDb,
} from "@/lib/member-coach-prefs-db";
import { type CoachAlertPrefs, normalizeCoachAlertPrefs } from "@/lib/alert-channels";
import { coachingModeFromPrefs, type MemberCoachingMode } from "@/lib/member-coaching-mode";

export type MemberCoachPrefs = {
  userId: string;
  coachingMode?: MemberCoachingMode;
  alertOverrides: Partial<CoachAlertPrefs>;
  updatedAt: string;
};

type PrefsStore = Record<string, MemberCoachPrefs>;

const BLOB_PATH = "demo/member-coach-prefs.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "member-coach-prefs.dev.json");

let memoryStore: PrefsStore | null = null;

function normalizePrefs(raw: unknown, userId: string): MemberCoachPrefs {
  if (!raw || typeof raw !== "object") {
    return { userId, alertOverrides: {}, updatedAt: new Date().toISOString() };
  }
  const data = raw as Partial<MemberCoachPrefs>;
  const overrides: Partial<CoachAlertPrefs> = {};
  if (data.alertOverrides && typeof data.alertOverrides === "object") {
    const full = normalizeCoachAlertPrefs(data.alertOverrides);
    for (const key of Object.keys(full) as Array<keyof CoachAlertPrefs>) {
      if ((data.alertOverrides as CoachAlertPrefs)[key]) {
        overrides[key] = full[key];
      }
    }
  }
  const coachingMode =
    data.coachingMode === "live" || data.coachingMode === "async" ? data.coachingMode : undefined;

  return {
    userId,
    coachingMode,
    alertOverrides: overrides,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<PrefsStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as PrefsStore) || {};
    },
    fallback: () => ({}),
  });
  memoryStore = hydrated as PrefsStore;
  return memoryStore;
}

export async function getMemberCoachPrefs(userId: string): Promise<MemberCoachPrefs> {
  if (!isDemoMode()) {
    const row = await getMemberCoachPrefsFromDb(userId);
    return row ?? normalizePrefs(undefined, userId);
  }
  const store = await getStore();
  return normalizePrefs(store[userId], userId);
}

export async function resolveMemberCoachingMode(userId: string): Promise<MemberCoachingMode> {
  const prefs = await getMemberCoachPrefs(userId);
  return coachingModeFromPrefs(prefs, userId);
}

export async function getMemberCoachPrefsMap(): Promise<Map<string, MemberCoachPrefs>> {
  if (!isDemoMode()) {
    return loadMemberCoachPrefsMapFromDb();
  }
  const store = await getStore();
  return new Map(Object.entries(store).map(([id, raw]) => [id, normalizePrefs(raw, id)]));
}

export async function saveMemberCoachPrefs(
  userId: string,
  input: {
    alertOverrides?: Partial<CoachAlertPrefs>;
    coachingMode?: MemberCoachingMode;
  },
): Promise<MemberCoachPrefs> {
  const existing = await getMemberCoachPrefs(userId);
  const next: MemberCoachPrefs = {
    userId,
    coachingMode: input.coachingMode ?? existing.coachingMode,
    alertOverrides: input.alertOverrides ?? existing.alertOverrides,
    updatedAt: new Date().toISOString(),
  };
  if (!isDemoMode()) {
    await persistMemberCoachPrefsToDb(next);
  } else {
    const store = await getStore();
    store[userId] = next;
    await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v as PrefsStore;
      },
    });
  }
  return next;
}