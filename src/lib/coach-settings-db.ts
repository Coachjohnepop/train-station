import "server-only";

import {
  defaultCoachAlertPrefs,
  normalizeCoachAlertPrefs,
  type CoachAlertPrefs,
} from "@/lib/alert-channels";
import type { CoachSettings } from "@/lib/coach-settings-store";
import { normalizeCommissionPayoutWeekday } from "@/lib/coach-settings-store";
import {
  normalizeGamificationPoints,
  type GamificationPointsMap,
} from "@/lib/gamification-types";
import {
  DEFAULT_RAMP_WEEKS,
  normalizeRampWeeks,
  type RampWeekTemplate,
} from "@/lib/member-ramp-template";
import {
  DEFAULT_WARMUP_BLOCKS,
  normalizeWarmupBlocks,
  type WarmupBlockTemplate,
} from "@/lib/warmup-template";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const SETTINGS_ID = "default";

function toIso(value: Date): string {
  return value.toISOString();
}

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
    updatedAt: new Date().toISOString(),
  };
}

function rowToSettings(row: {
  coachPhone: string | null;
  coachEmail: string | null;
  messagingEnabled: boolean;
  autoPromptIntroBooking: boolean;
  autoPromptFollowUpBooking: boolean;
  commissionPayoutMode: string;
  commissionPayoutWeekday: number;
  alertPrefs: unknown;
  warmupBlocks: unknown;
  rampTemplate: unknown;
  gamificationPoints: unknown;
  updatedAt: Date;
}): CoachSettings {
  return {
    coachPhone: row.coachPhone,
    coachEmail: row.coachEmail,
    messagingEnabled: row.messagingEnabled,
    autoPromptIntroBooking: row.autoPromptIntroBooking,
    autoPromptFollowUpBooking: row.autoPromptFollowUpBooking,
    commissionPayoutMode: row.commissionPayoutMode === "weekly" ? "weekly" : "on_demand",
    commissionPayoutWeekday: normalizeCommissionPayoutWeekday(row.commissionPayoutWeekday),
    alertPrefs: normalizeCoachAlertPrefs(row.alertPrefs as Partial<CoachAlertPrefs>),
    warmupBlocks: normalizeWarmupBlocks(row.warmupBlocks as WarmupBlockTemplate[] | null),
    rampTemplate: normalizeRampWeeks(row.rampTemplate as RampWeekTemplate[] | null),
    gamificationPoints: normalizeGamificationPoints(row.gamificationPoints as GamificationPointsMap | null),
    updatedAt: toIso(row.updatedAt),
  };
}

function settingsToRow(settings: CoachSettings) {
  return {
    id: SETTINGS_ID,
    coachPhone: settings.coachPhone,
    coachEmail: settings.coachEmail,
    messagingEnabled: settings.messagingEnabled,
    autoPromptIntroBooking: settings.autoPromptIntroBooking,
    autoPromptFollowUpBooking: settings.autoPromptFollowUpBooking,
    commissionPayoutMode: settings.commissionPayoutMode,
    commissionPayoutWeekday: settings.commissionPayoutWeekday,
    alertPrefs: settings.alertPrefs as Prisma.InputJsonValue,
    warmupBlocks: settings.warmupBlocks as Prisma.InputJsonValue,
    rampTemplate: settings.rampTemplate as Prisma.InputJsonValue,
    gamificationPoints: settings.gamificationPoints as Prisma.InputJsonValue,
    updatedAt: new Date(settings.updatedAt),
  };
}

export async function loadCoachSettingsFromDb(): Promise<CoachSettings> {
  const row = await prisma.coachSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) return defaultSettings();
  return rowToSettings(row);
}

export async function persistCoachSettingsToDb(settings: CoachSettings): Promise<void> {
  const data = settingsToRow(settings);
  await prisma.coachSettings.upsert({
    where: { id: SETTINGS_ID },
    create: data,
    update: {
      coachPhone: data.coachPhone,
      coachEmail: data.coachEmail,
      messagingEnabled: data.messagingEnabled,
      autoPromptIntroBooking: data.autoPromptIntroBooking,
      autoPromptFollowUpBooking: data.autoPromptFollowUpBooking,
      commissionPayoutMode: data.commissionPayoutMode,
      commissionPayoutWeekday: data.commissionPayoutWeekday,
      alertPrefs: data.alertPrefs,
      warmupBlocks: data.warmupBlocks,
      rampTemplate: data.rampTemplate,
      gamificationPoints: data.gamificationPoints,
      updatedAt: data.updatedAt,
    },
  });
}

export async function probeCoachSettingsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.coachSettings.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Coach settings DB probe failed";
    return { ok: false, message };
  }
}