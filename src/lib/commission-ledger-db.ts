import "server-only";

import type {
  CommissionPayoutRecord,
  PartnerPayoutLine,
} from "@/lib/commission-ledger-store";
import { prisma } from "@/lib/prisma";

function toIso(value: Date): string {
  return value.toISOString();
}

function parseOptionalDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rowToLine(row: {
  partnerId: string;
  partnerName: string;
  sharePercent: number;
  amountCents: number;
  transferId: string | null;
  status: string;
  error: string | null;
}): PartnerPayoutLine {
  const status =
    row.status === "paid" ||
    row.status === "failed" ||
    row.status === "skipped" ||
    row.status === "pending"
      ? row.status
      : "pending";
  return {
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    sharePercent: row.sharePercent,
    amountCents: row.amountCents,
    transferId: row.transferId,
    status,
    error: row.error,
  };
}

function rowToPayout(row: {
  id: string;
  period: string;
  mrrCents: number;
  tier1BaseCents: number;
  tier1CommissionCents: number;
  tier2BaseCents: number;
  tier2CommissionCents: number;
  totalCommissionCents: number;
  transferId: string | null;
  status: string;
  error: string | null;
  createdAt: Date;
  paidAt: Date | null;
  partnerLines: Array<{
    partnerId: string;
    partnerName: string;
    sharePercent: number;
    amountCents: number;
    transferId: string | null;
    status: string;
    error: string | null;
  }>;
}): CommissionPayoutRecord {
  const status =
    row.status === "paid" ||
    row.status === "partial" ||
    row.status === "failed" ||
    row.status === "pending"
      ? row.status
      : "pending";

  return {
    id: row.id,
    period: row.period,
    mrrCents: row.mrrCents,
    tier1BaseCents: row.tier1BaseCents,
    tier1CommissionCents: row.tier1CommissionCents,
    tier2BaseCents: row.tier2BaseCents,
    tier2CommissionCents: row.tier2CommissionCents,
    totalCommissionCents: row.totalCommissionCents,
    transferId: row.transferId,
    partnerLines: row.partnerLines.map(rowToLine),
    status,
    createdAt: toIso(row.createdAt),
    paidAt: row.paidAt ? toIso(row.paidAt) : null,
    error: row.error,
  };
}

function payoutToRow(record: CommissionPayoutRecord) {
  return {
    id: record.id,
    period: record.period,
    mrrCents: record.mrrCents,
    tier1BaseCents: record.tier1BaseCents,
    tier1CommissionCents: record.tier1CommissionCents,
    tier2BaseCents: record.tier2BaseCents,
    tier2CommissionCents: record.tier2CommissionCents,
    totalCommissionCents: record.totalCommissionCents,
    transferId: record.transferId,
    status: record.status,
    error: record.error,
    createdAt: new Date(record.createdAt),
    paidAt: parseOptionalDate(record.paidAt),
  };
}

export async function listCommissionPayoutsFromDb(): Promise<CommissionPayoutRecord[]> {
  const rows = await prisma.commissionPayout.findMany({
    include: { partnerLines: true },
    orderBy: { period: "desc" },
  });
  return rows.map(rowToPayout);
}

export async function getCommissionPayoutForPeriodFromDb(
  period: string,
): Promise<CommissionPayoutRecord | null> {
  const row = await prisma.commissionPayout.findUnique({
    where: { period },
    include: { partnerLines: true },
  });
  return row ? rowToPayout(row) : null;
}

export async function upsertCommissionPayoutToDb(record: CommissionPayoutRecord): Promise<void> {
  const data = payoutToRow(record);
  await prisma.$transaction(async (tx) => {
    await tx.commissionPayout.upsert({
      where: { period: record.period },
      create: data,
      update: {
        mrrCents: data.mrrCents,
        tier1BaseCents: data.tier1BaseCents,
        tier1CommissionCents: data.tier1CommissionCents,
        tier2BaseCents: data.tier2BaseCents,
        tier2CommissionCents: data.tier2CommissionCents,
        totalCommissionCents: data.totalCommissionCents,
        transferId: data.transferId,
        status: data.status,
        error: data.error,
        paidAt: data.paidAt,
      },
    });

    await tx.commissionPayoutLine.deleteMany({ where: { payoutId: record.id } });
    if (record.partnerLines.length > 0) {
      await tx.commissionPayoutLine.createMany({
        data: record.partnerLines.map((line) => ({
          payoutId: record.id,
          partnerId: line.partnerId,
          partnerName: line.partnerName,
          sharePercent: line.sharePercent,
          amountCents: line.amountCents,
          transferId: line.transferId,
          status: line.status,
          error: line.error,
        })),
      });
    }
  });
}

export async function probeCommissionLedgerDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.commissionPayout.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Commission ledger DB probe failed";
    return { ok: false, message };
  }
}