import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { type CoachAlertPrefs, normalizeCoachAlertPrefs } from "@/lib/alert-channels";

export type MemberCoachPrefs = {
  userId: string;
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
  return {
    userId,
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
  const store = await getStore();
  return normalizePrefs(store[userId], userId);
}

export async function saveMemberCoachPrefs(
  userId: string,
  alertOverrides: Partial<CoachAlertPrefs>,
): Promise<MemberCoachPrefs> {
  const store = await getStore();
  const next: MemberCoachPrefs = {
    userId,
    alertOverrides,
    updatedAt: new Date().toISOString(),
  };
  store[userId] = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as PrefsStore;
    },
  });
  return next;
}