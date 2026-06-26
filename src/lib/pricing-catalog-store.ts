import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import type { MembershipPlan } from "@/lib/signup-plans";

export type PricingPlanRecord = {
  planId: MembershipPlan;
  label: string;
  priceCents: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  enabled: boolean;
  updatedAt: string;
};

type PricingCatalogStore = {
  plans: Partial<Record<MembershipPlan, PricingPlanRecord>>;
  updatedAt: string;
};

const BLOB_PATH = "demo/pricing-catalog.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "pricing-catalog.dev.json");

const PAID_PLANS: MembershipPlan[] = ["member", "business", "pro"];

let memoryStore: PricingCatalogStore | null = null;

function emptyStore(): PricingCatalogStore {
  return { plans: {}, updatedAt: new Date().toISOString() };
}

function normalizeRecord(raw: unknown): PricingPlanRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PricingPlanRecord>;
  if (!data.planId || !PAID_PLANS.includes(data.planId)) return null;
  return {
    planId: data.planId,
    label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.planId,
    priceCents: Math.max(0, Math.round(Number(data.priceCents) || 0)),
    stripePriceId:
      typeof data.stripePriceId === "string" && data.stripePriceId.trim()
        ? data.stripePriceId.trim()
        : null,
    stripeProductId:
      typeof data.stripeProductId === "string" && data.stripeProductId.trim()
        ? data.stripeProductId.trim()
        : null,
    enabled: data.enabled !== false,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<PricingCatalogStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v as PricingCatalogStore;
    },
    fallback: emptyStore,
  });
  memoryStore = hydrated as PricingCatalogStore;
  return memoryStore;
}

export async function getPricingPlanRecord(
  planId: MembershipPlan,
): Promise<PricingPlanRecord | null> {
  const store = await getStore();
  const raw = store.plans?.[planId];
  return raw ? normalizeRecord(raw) : null;
}

export async function upsertPricingPlanRecord(
  planId: MembershipPlan,
  patch: Partial<
    Pick<PricingPlanRecord, "label" | "priceCents" | "stripePriceId" | "stripeProductId" | "enabled">
  >,
): Promise<PricingPlanRecord> {
  const store = await getStore();
  const current = store.plans?.[planId];
  const now = new Date().toISOString();
  const next: PricingPlanRecord = {
    planId,
    label:
      patch.label !== undefined
        ? patch.label.trim() || planId
        : (current?.label ?? planId),
    priceCents:
      patch.priceCents !== undefined
        ? Math.max(0, Math.round(patch.priceCents))
        : Math.max(0, Math.round(Number(current?.priceCents) || 0)),
    stripePriceId:
      patch.stripePriceId !== undefined
        ? patch.stripePriceId?.trim() || null
        : (current?.stripePriceId ?? null),
    stripeProductId:
      patch.stripeProductId !== undefined
        ? patch.stripeProductId?.trim() || null
        : (current?.stripeProductId ?? null),
    enabled: patch.enabled !== undefined ? patch.enabled : (current?.enabled ?? true),
    updatedAt: now,
  };

  store.plans = { ...store.plans, [planId]: next };
  store.updatedAt = now;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as PricingCatalogStore;
    },
  });
  return next;
}

export async function listPricingPlanRecords(): Promise<PricingPlanRecord[]> {
  const store = await getStore();
  return PAID_PLANS.map((planId) => normalizeRecord(store.plans?.[planId])).filter(
    (r): r is PricingPlanRecord => Boolean(r),
  );
}