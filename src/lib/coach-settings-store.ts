import "server-only";

import path from "path";
import {
  defaultCoachAlertPrefs,
  normalizeCoachAlertPrefs,
  type CoachAlertPrefs,
} from "@/lib/alert-channels";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  DEFAULT_WARMUP_BLOCKS,
  normalizeWarmupBlocks,
  type WarmupBlockTemplate,
} from "@/lib/warmup-template";
import {
  DEFAULT_RAMP_WEEKS,
  normalizeRampWeeks,
  type RampWeekTemplate,
} from "@/lib/member-ramp-template";

export type CoachSettings = {
  coachPhone: string | null;
  coachEmail: string | null;
  alertPrefs: CoachAlertPrefs;
  warmupBlocks: WarmupBlockTemplate[];
  rampTemplate: RampWeekTemplate[];
  updatedAt: string;
};

const BLOB_PATH = "demo/coach-settings.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "coach-settings.dev.json");

let memoryStore: CoachSettings | null = null;

function defaultSettings(): CoachSettings {
  return {
    coachPhone: null,
    coachEmail: process.env.COACH_NOTIFY_EMAIL?.trim() || null,
    alertPrefs: defaultCoachAlertPrefs(),
    warmupBlocks: DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b })),
    rampTemplate: DEFAULT_RAMP_WEEKS.map((w) => ({
      ...w,
      days: w.days.map((d) => ({ ...d })),
    })),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSettings(raw: unknown): CoachSettings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== "object") return defaults;
  const data = raw as Partial<CoachSettings>;
  return {
    coachPhone: typeof data.coachPhone === "string" ? data.coachPhone : defaults.coachPhone,
    coachEmail: typeof data.coachEmail === "string" ? data.coachEmail : defaults.coachEmail,
    alertPrefs: normalizeCoachAlertPrefs(data.alertPrefs),
    warmupBlocks: normalizeWarmupBlocks(data.warmupBlocks),
    rampTemplate: normalizeRampWeeks(data.rampTemplate),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<CoachSettings> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalizeSettings(v);
    },
    fallback: defaultSettings,
  });
  memoryStore = normalizeSettings(hydrated);
  return memoryStore;
}

export async function getCoachSettings(): Promise<CoachSettings> {
  return getStore();
}

export async function saveCoachSettings(
  patch: Partial<
    Pick<CoachSettings, "coachPhone" | "coachEmail" | "alertPrefs" | "warmupBlocks" | "rampTemplate">
  >,
): Promise<CoachSettings> {
  const current = await getStore();
  const next: CoachSettings = {
    ...current,
    ...patch,
    alertPrefs: patch.alertPrefs ? normalizeCoachAlertPrefs(patch.alertPrefs) : current.alertPrefs,
    warmupBlocks: patch.warmupBlocks
      ? normalizeWarmupBlocks(patch.warmupBlocks)
      : current.warmupBlocks,
    rampTemplate: patch.rampTemplate ? normalizeRampWeeks(patch.rampTemplate) : current.rampTemplate,
    updatedAt: new Date().toISOString(),
  };
  memoryStore = next;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalizeSettings(v);
    },
  });
  return next;
}