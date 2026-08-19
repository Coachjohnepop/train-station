import "server-only";

import path from "path";
import {
  defaultCoachAlertPrefs,
  normalizeCoachAlertPrefs,
  type CoachAlertPrefs,
} from "@/lib/alert-channels";
import { isDemoMode } from "@/lib/demo-enrollments";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  loadCoachSettingsFromDb,
  persistCoachSettingsToDb,
} from "@/lib/coach-settings-db";
import { invalidateMessagingGateCache } from "@/lib/messaging-gate";
import {
  DEFAULT_WARMUP_BLOCKS,
  normalizeWarmupBlocks,
  type WarmupBlockTemplate,
} from "@/lib/warmup-template";
import {
  DEFAULT_WARMUP_REST_SECONDS,
  normalizeWarmupRestSeconds,
} from "@/lib/warmup-group";
import {
  DEFAULT_RAMP_WEEKS,
  normalizeRampWeeks,
  type RampWeekTemplate,
} from "@/lib/member-ramp-template";
import {
  normalizeGamificationPoints,
  type GamificationPointsMap,
} from "@/lib/gamification-types";
import {
  normalizeProgramBlockDays,
  normalizeProgramStartMaxOffsetDays,
  normalizeProgramStartRecommendWeekday,
} from "@/lib/program-start-settings";

export type CommissionPayoutMode = "on_demand" | "weekly";

export type CoachSettings = {
  coachPhone: string | null;
  coachEmail: string | null;
  /** Master switch — when false, all outbound email (Resend) and carrier SMS are paused. */
  messagingEnabled: boolean;
  /** Show the intro booking card on member Today (pre-intake). Off by default — coach opts in. */
  autoPromptIntroBooking: boolean;
  /** Show follow-up booking card after coach requests a meeting on Members. Off by default. */
  autoPromptFollowUpBooking: boolean;
  /**
   * Partner revenue share payouts (Connect transfers).
   * on_demand = Jeremy runs payout manually; weekly = optional cron on commissionPayoutWeekday.
   */
  commissionPayoutMode: CommissionPayoutMode;
  /** 0=Sun … 6=Sat — only used when commissionPayoutMode is weekly. */
  commissionPayoutWeekday: number;
  alertPrefs: CoachAlertPrefs;
  warmupBlocks: WarmupBlockTemplate[];
  rampTemplate: RampWeekTemplate[];
  /** Point values for member score accomplishments (admin-editable). */
  gamificationPoints: GamificationPointsMap;
  /** New member program start — max days ahead they may pick Day 1. */
  programStartMaxOffsetDays: number;
  /** Weekday to recommend (0–6). Null = default to today. */
  programStartRecommendWeekday: number | null;
  /** Paid block length in calendar days. */
  programBlockDays: number;
  /** Rest after each warm-up movement (seconds). */
  warmupRestSeconds: number;
  updatedAt: string;
};

export const COMMISSION_PAYOUT_WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export function normalizeCommissionPayoutWeekday(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(6, Math.floor(n)));
}

export function automatedCommissionPayoutAllowed(settings: CoachSettings, now = new Date()): {
  allowed: boolean;
  reason?: string;
} {
  if (settings.commissionPayoutMode === "on_demand") {
    return {
      allowed: false,
      reason:
        "Automated payouts are off — commission payout mode is Pay on demand. Use Run payout now in Admin → Commission.",
    };
  }
  const today = now.getDay();
  if (today !== settings.commissionPayoutWeekday) {
    const label =
      COMMISSION_PAYOUT_WEEKDAYS.find((d) => d.value === settings.commissionPayoutWeekday)?.label ??
      "scheduled day";
    return {
      allowed: false,
      reason: `Weekly payout is scheduled for ${label}s only (today is ${COMMISSION_PAYOUT_WEEKDAYS.find((d) => d.value === today)?.label ?? "another day"}).`,
    };
  }
  return { allowed: true };
}

const BLOB_PATH = "demo/coach-settings.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "coach-settings.dev.json");

let memoryStore: CoachSettings | null = null;

function defaultSettings(): CoachSettings {
  return {
    coachPhone: null,
    coachEmail: process.env.COACH_NOTIFY_EMAIL?.trim() || null,
    messagingEnabled: true,
    autoPromptIntroBooking: false,
    autoPromptFollowUpBooking: false,
    commissionPayoutMode: "on_demand",
    commissionPayoutWeekday: 5,
    alertPrefs: defaultCoachAlertPrefs(),
    warmupBlocks: DEFAULT_WARMUP_BLOCKS.map((b) => ({ ...b })),
    rampTemplate: DEFAULT_RAMP_WEEKS.map((w) => ({
      ...w,
      days: w.days.map((d) => ({ ...d })),
    })),
    gamificationPoints: normalizeGamificationPoints(null),
    programStartMaxOffsetDays: normalizeProgramStartMaxOffsetDays(null),
    programStartRecommendWeekday: normalizeProgramStartRecommendWeekday(1),
    programBlockDays: normalizeProgramBlockDays(null),
    warmupRestSeconds: DEFAULT_WARMUP_REST_SECONDS,
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
    messagingEnabled: data.messagingEnabled === false ? false : true,
    autoPromptIntroBooking: data.autoPromptIntroBooking === true,
    autoPromptFollowUpBooking: data.autoPromptFollowUpBooking === true,
    commissionPayoutMode: data.commissionPayoutMode === "weekly" ? "weekly" : "on_demand",
    commissionPayoutWeekday: normalizeCommissionPayoutWeekday(data.commissionPayoutWeekday),
    alertPrefs: normalizeCoachAlertPrefs(data.alertPrefs),
    warmupBlocks: normalizeWarmupBlocks(data.warmupBlocks),
    rampTemplate: normalizeRampWeeks(data.rampTemplate),
    gamificationPoints: normalizeGamificationPoints(data.gamificationPoints),
    programStartMaxOffsetDays:
      data.programStartMaxOffsetDays === undefined
        ? defaults.programStartMaxOffsetDays
        : normalizeProgramStartMaxOffsetDays(data.programStartMaxOffsetDays),
    programStartRecommendWeekday:
      data.programStartRecommendWeekday === undefined
        ? defaults.programStartRecommendWeekday
        : normalizeProgramStartRecommendWeekday(data.programStartRecommendWeekday),
    programBlockDays:
      data.programBlockDays === undefined
        ? defaults.programBlockDays
        : normalizeProgramBlockDays(data.programBlockDays),
    warmupRestSeconds: normalizeWarmupRestSeconds(
      data.warmupRestSeconds ?? defaults.warmupRestSeconds,
    ),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<CoachSettings> {
  if (!isDemoMode()) {
    const settings = await loadCoachSettingsFromDb();
    memoryStore = settings;
    return settings;
  }

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
    Pick<
      CoachSettings,
      | "coachPhone"
      | "coachEmail"
      | "messagingEnabled"
      | "autoPromptIntroBooking"
      | "autoPromptFollowUpBooking"
      | "commissionPayoutMode"
      | "commissionPayoutWeekday"
      | "alertPrefs"
      | "warmupBlocks"
      | "rampTemplate"
      | "gamificationPoints"
      | "programStartMaxOffsetDays"
      | "programStartRecommendWeekday"
      | "programBlockDays"
      | "warmupRestSeconds"
    >
  >,
): Promise<CoachSettings> {
  const current = await getStore();
  const next: CoachSettings = {
    ...current,
    ...patch,
    messagingEnabled:
      patch.messagingEnabled === undefined ? current.messagingEnabled : patch.messagingEnabled !== false,
    autoPromptIntroBooking:
      patch.autoPromptIntroBooking === undefined
        ? current.autoPromptIntroBooking
        : patch.autoPromptIntroBooking === true,
    autoPromptFollowUpBooking:
      patch.autoPromptFollowUpBooking === undefined
        ? current.autoPromptFollowUpBooking
        : patch.autoPromptFollowUpBooking === true,
    commissionPayoutMode:
      patch.commissionPayoutMode === undefined
        ? current.commissionPayoutMode
        : patch.commissionPayoutMode === "weekly"
          ? "weekly"
          : "on_demand",
    commissionPayoutWeekday:
      patch.commissionPayoutWeekday === undefined
        ? current.commissionPayoutWeekday
        : normalizeCommissionPayoutWeekday(patch.commissionPayoutWeekday),
    alertPrefs: patch.alertPrefs ? normalizeCoachAlertPrefs(patch.alertPrefs) : current.alertPrefs,
    warmupBlocks: patch.warmupBlocks
      ? normalizeWarmupBlocks(patch.warmupBlocks)
      : current.warmupBlocks,
    rampTemplate: patch.rampTemplate ? normalizeRampWeeks(patch.rampTemplate) : current.rampTemplate,
    gamificationPoints: patch.gamificationPoints
      ? normalizeGamificationPoints(patch.gamificationPoints)
      : current.gamificationPoints,
    programStartMaxOffsetDays:
      patch.programStartMaxOffsetDays === undefined
        ? current.programStartMaxOffsetDays
        : normalizeProgramStartMaxOffsetDays(patch.programStartMaxOffsetDays),
    programStartRecommendWeekday:
      patch.programStartRecommendWeekday === undefined
        ? current.programStartRecommendWeekday
        : normalizeProgramStartRecommendWeekday(patch.programStartRecommendWeekday),
    programBlockDays:
      patch.programBlockDays === undefined
        ? current.programBlockDays
        : normalizeProgramBlockDays(patch.programBlockDays),
    warmupRestSeconds:
      patch.warmupRestSeconds === undefined
        ? current.warmupRestSeconds
        : normalizeWarmupRestSeconds(patch.warmupRestSeconds),
    updatedAt: new Date().toISOString(),
  };
  memoryStore = next;
  invalidateMessagingGateCache();
  if (!isDemoMode()) {
    await persistCoachSettingsToDb(next);
  } else {
    await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: next,
      setMemory: (v) => {
        memoryStore = normalizeSettings(v);
      },
    });
  }
  return next;
}