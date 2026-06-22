import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type PartnerPayoutLineStatus = "pending" | "paid" | "failed" | "skipped";

export type PartnerPayoutLine = {
  partnerId: string;
  partnerName: string;
  sharePercent: number;
  amountCents: number;
  transferId: string | null;
  status: PartnerPayoutLineStatus;
  error: string | null;
};

export type CommissionPayoutStatus = "pending" | "paid" | "partial" | "failed";

export type CommissionPayoutRecord = {
  id: string;
  period: string;
  mrrCents: number;
  tier1BaseCents: number;
  tier1CommissionCents: number;
  tier2BaseCents: number;
  tier2CommissionCents: number;
  totalCommissionCents: number;
  /** @deprecated Single-recipient legacy field — see partnerLines */
  transferId: string | null;
  partnerLines: PartnerPayoutLine[];
  status: CommissionPayoutStatus;
  createdAt: string;
  paidAt: string | null;
  error: string | null;
};

type LedgerStore = {
  payouts: CommissionPayoutRecord[];
  updatedAt: string;
};

const BLOB_PATH = "demo/commission-ledger.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "commission-ledger.dev.json");

let memoryStore: LedgerStore | null = null;

function emptyStore(): LedgerStore {
  return { payouts: [], updatedAt: new Date().toISOString() };
}

function normalizePayout(raw: unknown): CommissionPayoutRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<CommissionPayoutRecord>;
  if (!data.id || !data.period) return null;

  let partnerLines: PartnerPayoutLine[] = Array.isArray(data.partnerLines)
    ? data.partnerLines.filter((l): l is PartnerPayoutLine => Boolean(l && typeof l === "object"))
    : [];

  if (partnerLines.length === 0 && data.transferId) {
    partnerLines = [
      {
        partnerId: "legacy",
        partnerName: "Partner",
        sharePercent: 100,
        amountCents: data.totalCommissionCents ?? 0,
        transferId: data.transferId,
        status: data.status === "paid" ? "paid" : data.status === "failed" ? "failed" : "pending",
        error: data.error ?? null,
      },
    ];
  }

  let status: CommissionPayoutStatus = "pending";
  const rawStatus = data.status;
  if (rawStatus === "paid" || rawStatus === "partial" || rawStatus === "failed" || rawStatus === "pending") {
    status = rawStatus;
  } else if (partnerLines.every((l) => l.status === "paid")) {
    status = "paid";
  } else if (partnerLines.some((l) => l.status === "paid")) {
    status = "partial";
  } else if (partnerLines.some((l) => l.status === "failed")) {
    status = "failed";
  }

  return {
    id: data.id,
    period: data.period,
    mrrCents: data.mrrCents ?? 0,
    tier1BaseCents: data.tier1BaseCents ?? 0,
    tier1CommissionCents: data.tier1CommissionCents ?? 0,
    tier2BaseCents: data.tier2BaseCents ?? 0,
    tier2CommissionCents: data.tier2CommissionCents ?? 0,
    totalCommissionCents: data.totalCommissionCents ?? 0,
    transferId: data.transferId ?? partnerLines[0]?.transferId ?? null,
    partnerLines,
    status,
    createdAt: data.createdAt || new Date().toISOString(),
    paidAt: data.paidAt ?? null,
    error: data.error ?? null,
  };
}

function normalize(raw: unknown): LedgerStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<LedgerStore>;
  const payouts = Array.isArray(data.payouts)
    ? data.payouts
        .map(normalizePayout)
        .filter((p): p is CommissionPayoutRecord => Boolean(p))
    : [];
  return {
    payouts,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

async function getStore(): Promise<LedgerStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
    fallback: emptyStore,
  });
  memoryStore = normalize(hydrated);
  return memoryStore;
}

export async function listCommissionPayouts(): Promise<CommissionPayoutRecord[]> {
  const store = await getStore();
  return [...store.payouts].sort((a, b) => b.period.localeCompare(a.period));
}

export async function getCommissionPayoutForPeriod(
  period: string,
): Promise<CommissionPayoutRecord | null> {
  const store = await getStore();
  const payout = store.payouts.find((p) => p.period === period);
  return payout ? normalizePayout(payout) : null;
}

export async function upsertCommissionPayout(
  record: CommissionPayoutRecord,
): Promise<CommissionPayoutRecord> {
  const store = await getStore();
  const normalized = normalizePayout(record)!;
  const idx = store.payouts.findIndex((p) => p.period === normalized.period);
  if (idx >= 0) store.payouts[idx] = normalized;
  else store.payouts.push(normalized);
  store.updatedAt = new Date().toISOString();

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return normalized;
}