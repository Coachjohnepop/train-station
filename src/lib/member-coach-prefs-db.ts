import "server-only";

import { type CoachAlertPrefs, normalizeCoachAlertPrefs } from "@/lib/alert-channels";
import type { MemberCoachingMode } from "@/lib/member-coaching-mode";
import type { MemberCoachPrefs } from "@/lib/member-coach-prefs-store";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

function toIso(value: Date): string {
  return value.toISOString();
}

function rowToPrefs(row: {
  userId: string;
  coachingMode: string | null;
  alertOverrides: unknown;
  updatedAt: Date;
}): MemberCoachPrefs {
  const overrides: Partial<CoachAlertPrefs> = {};
  if (row.alertOverrides && typeof row.alertOverrides === "object") {
    const full = normalizeCoachAlertPrefs(row.alertOverrides as Partial<CoachAlertPrefs>);
    for (const key of Object.keys(full) as Array<keyof CoachAlertPrefs>) {
      if ((row.alertOverrides as CoachAlertPrefs)[key]) {
        overrides[key] = full[key];
      }
    }
  }
  const coachingMode: MemberCoachingMode | undefined =
    row.coachingMode === "live" || row.coachingMode === "async" ? row.coachingMode : undefined;

  return {
    userId: row.userId,
    coachingMode,
    alertOverrides: overrides,
    updatedAt: toIso(row.updatedAt),
  };
}

function prefsToRow(prefs: MemberCoachPrefs) {
  return {
    userId: prefs.userId,
    coachingMode: prefs.coachingMode ?? null,
    alertOverrides: prefs.alertOverrides as Prisma.InputJsonValue,
    updatedAt: new Date(prefs.updatedAt),
  };
}

export async function getMemberCoachPrefsFromDb(userId: string): Promise<MemberCoachPrefs | null> {
  const row = await prisma.memberCoachPrefs.findUnique({ where: { userId } });
  return row ? rowToPrefs(row) : null;
}

export async function loadMemberCoachPrefsMapFromDb(): Promise<Map<string, MemberCoachPrefs>> {
  const rows = await prisma.memberCoachPrefs.findMany();
  return new Map(rows.map((row) => [row.userId, rowToPrefs(row)]));
}

export async function persistMemberCoachPrefsToDb(prefs: MemberCoachPrefs): Promise<void> {
  const data = prefsToRow(prefs);
  await prisma.memberCoachPrefs.upsert({
    where: { userId: prefs.userId },
    create: data,
    update: {
      coachingMode: data.coachingMode,
      alertOverrides: data.alertOverrides,
      updatedAt: data.updatedAt,
    },
  });
}

export async function probeMemberCoachPrefsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.memberCoachPrefs.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Member coach prefs DB probe failed";
    return { ok: false, message };
  }
}