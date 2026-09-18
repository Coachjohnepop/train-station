import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import {
  EVEN_SPLIT_PERCENTS,
  type MoneyDeskSettingsInput,
} from "@/lib/money-desk-split";

export const DEFAULT_MONEY_DESK_SETTINGS: MoneyDeskSettingsInput = {
  grokCents: 3000,
  vercelCents: 2000,
  supabaseCents: 3500,
  refundBufferCents: 5000,
  ...EVEN_SPLIT_PERCENTS,
};

const ID = "default";

export async function getMoneyDeskSettings(): Promise<
  MoneyDeskSettingsInput & { updatedAt: string | null; updatedBy: string | null }
> {
  if (!isDatabaseConfigured()) {
    return { ...DEFAULT_MONEY_DESK_SETTINGS, updatedAt: null, updatedBy: null };
  }
  try {
    const row = await prisma.moneyDeskSettings.findUnique({ where: { id: ID } });
    if (!row) {
      return { ...DEFAULT_MONEY_DESK_SETTINGS, updatedAt: null, updatedBy: null };
    }
    return {
      grokCents: row.grokCents,
      vercelCents: row.vercelCents,
      supabaseCents: row.supabaseCents,
      refundBufferCents: row.refundBufferCents,
      platformFeesPercent: row.platformFeesPercent,
      johnPayPercent: row.johnPayPercent,
      reinvestPercent: row.reinvestPercent,
      jeremyPayPercent: row.jeremyPayPercent,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  } catch {
    return { ...DEFAULT_MONEY_DESK_SETTINGS, updatedAt: null, updatedBy: null };
  }
}

export async function saveMoneyDeskSettings(
  patch: Partial<MoneyDeskSettingsInput>,
  updatedBy: string | null,
): Promise<MoneyDeskSettingsInput> {
  const current = await getMoneyDeskSettings();
  const next: MoneyDeskSettingsInput = {
    grokCents: clampLine(patch.grokCents ?? current.grokCents),
    vercelCents: clampLine(patch.vercelCents ?? current.vercelCents),
    supabaseCents: clampLine(patch.supabaseCents ?? current.supabaseCents),
    refundBufferCents: clampLine(patch.refundBufferCents ?? current.refundBufferCents, 20_000),
    platformFeesPercent: clampPct(patch.platformFeesPercent ?? current.platformFeesPercent),
    johnPayPercent: clampPct(patch.johnPayPercent ?? current.johnPayPercent),
    reinvestPercent: clampPct(patch.reinvestPercent ?? current.reinvestPercent),
    jeremyPayPercent: clampPct(patch.jeremyPayPercent ?? current.jeremyPayPercent),
  };
  const sum =
    next.platformFeesPercent +
    next.johnPayPercent +
    next.reinvestPercent +
    next.jeremyPayPercent;
  if (sum !== 100) {
    throw new Error(`Percents must add to 100 (got ${sum}).`);
  }
  if (!isDatabaseConfigured()) return next;
  await prisma.moneyDeskSettings.upsert({
    where: { id: ID },
    create: { id: ID, ...next, updatedBy },
    update: { ...next, updatedBy },
  });
  return next;
}

function clampLine(n: number, max = 50_000): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
