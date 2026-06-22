import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type CommissionPartnerConfig = {
  partnerAccountId: string | null;
  partnerEmail: string | null;
  partnerName: string | null;
  updatedAt: string;
};

const BLOB_PATH = "demo/commission-config.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "commission-config.dev.json");

let memoryStore: CommissionPartnerConfig | null = null;

function emptyConfig(): CommissionPartnerConfig {
  return {
    partnerAccountId: process.env.STRIPE_CONNECT_PARTNER_ACCOUNT_ID?.trim() || null,
    partnerEmail: process.env.STRIPE_COMMISSION_PARTNER_EMAIL?.trim() || null,
    partnerName: process.env.STRIPE_COMMISSION_PARTNER_NAME?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
}

function normalize(raw: unknown): CommissionPartnerConfig {
  const fallback = emptyConfig();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<CommissionPartnerConfig>;
  return {
    partnerAccountId:
      (typeof data.partnerAccountId === "string" && data.partnerAccountId.trim()) ||
      fallback.partnerAccountId,
    partnerEmail:
      (typeof data.partnerEmail === "string" && data.partnerEmail.trim()) ||
      fallback.partnerEmail,
    partnerName:
      (typeof data.partnerName === "string" && data.partnerName.trim()) ||
      fallback.partnerName,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export async function getCommissionPartnerConfig(): Promise<CommissionPartnerConfig> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
    fallback: emptyConfig,
  });
  const config = normalize(hydrated);
  memoryStore = config;
  return config;
}

export async function saveCommissionPartnerConfig(
  patch: Partial<Pick<CommissionPartnerConfig, "partnerAccountId" | "partnerEmail" | "partnerName">>,
): Promise<CommissionPartnerConfig> {
  const current = await getCommissionPartnerConfig();
  const next: CommissionPartnerConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: next,
    setMemory: (v) => {
      memoryStore = normalize(v);
    },
  });

  return next;
}

export async function resolvePartnerAccountId(): Promise<string | null> {
  const config = await getCommissionPartnerConfig();
  return config.partnerAccountId;
}