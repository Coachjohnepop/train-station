import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type CommissionPayoutStatus = "pending" | "paid" | "failed";

export type CommissionPayoutRecord = {
  id: string;
  period: string;
  mrrCents: number;
  tier1BaseCents: number;
  tier1CommissionCents: number;
  tier2BaseCents: number;
  tier2CommissionCents: number;
  totalCommissionCents: number;
  transferId: string | null;
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

function normalize(raw: unknown): LedgerStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<LedgerStore>;
  const payouts = Array.isArray(data.payouts)
    ? data.payouts.filter((p): p is CommissionPayoutRecord => Boolean(p && typeof p === "object"))
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
  return store.payouts.find((p) => p.period === period) ?? null;
}

export async function upsertCommissionPayout(
  record: CommissionPayoutRecord,
): Promise<CommissionPayoutRecord> {
  const store = await getStore();
  const idx = store.payouts.findIndex((p) => p.period === record.period);
  if (idx >= 0) store.payouts[idx] = record;
  else store.payouts.push(record);
  store.updatedAt = new Date().toISOString();

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return record;
}