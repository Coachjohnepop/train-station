import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import type { CustomTrainingParameters } from "@/lib/product-offers";

export type CustomTrainingOffer = {
  id: string;
  label: string;
  memberEmail: string | null;
  memberUserId: string | null;
  priceCents: number;
  currency: string;
  parameters: CustomTrainingParameters;
  status: "draft" | "sent" | "paid" | "canceled";
  stripeCheckoutSessionId: string | null;
  createdByEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  offers: CustomTrainingOffer[];
  updatedAt: string;
};

const BLOB_PATH = "demo/custom-training-offers.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "custom-training-offers.dev.json");

let memoryStore: Store | null = null;

function emptyStore(): Store {
  return { offers: [], updatedAt: new Date().toISOString() };
}

function normalizeOffer(raw: unknown): CustomTrainingOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<CustomTrainingOffer>;
  if (!data.id || !data.label) return null;
  const params = data.parameters as CustomTrainingParameters | undefined;
  return {
    id: data.id,
    label: data.label.trim(),
    memberEmail: data.memberEmail?.trim().toLowerCase() || null,
    memberUserId: data.memberUserId?.trim() || null,
    priceCents: Math.max(0, Math.round(Number(data.priceCents) || 0)),
    currency: data.currency?.trim() || "usd",
    parameters: {
      daysPerWeek: Math.max(1, Math.min(7, Number(params?.daysPerWeek) || 3)),
      minutesPerSession: Math.max(15, Math.min(180, Number(params?.minutesPerSession) || 60)),
      sessionsPerDay: Math.max(1, Math.min(4, Number(params?.sessionsPerDay) || 1)),
      dropInDays: Array.isArray(params?.dropInDays)
        ? params.dropInDays.map((d) => String(d).toLowerCase())
        : [],
      notes: typeof params?.notes === "string" ? params.notes : null,
    },
    status:
      data.status === "sent" || data.status === "paid" || data.status === "canceled"
        ? data.status
        : "draft",
    stripeCheckoutSessionId: data.stripeCheckoutSessionId ?? null,
    createdByEmail: data.createdByEmail ?? null,
    notes: typeof data.notes === "string" ? data.notes : null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function getStore(): Promise<Store> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v as Store;
    },
    fallback: emptyStore,
  });
  const store = hydrated as Store;
  memoryStore = store;
  return store;
}

export async function listCustomTrainingOffers(): Promise<CustomTrainingOffer[]> {
  const store = await getStore();
  return [...(store.offers || [])]
    .map(normalizeOffer)
    .filter((o): o is CustomTrainingOffer => Boolean(o))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCustomTrainingOffer(id: string): Promise<CustomTrainingOffer | null> {
  const store = await getStore();
  const found = store.offers?.find((o) => o.id === id);
  return found ? normalizeOffer(found) : null;
}

export async function createCustomTrainingOffer(input: {
  label: string;
  memberEmail?: string | null;
  memberUserId?: string | null;
  priceCents: number;
  parameters: CustomTrainingParameters;
  notes?: string | null;
  createdByEmail?: string | null;
}): Promise<CustomTrainingOffer> {
  const store = await getStore();
  const now = new Date().toISOString();
  const offer: CustomTrainingOffer = {
    id: randomUUID(),
    label: input.label.trim(),
    memberEmail: input.memberEmail?.trim().toLowerCase() || null,
    memberUserId: input.memberUserId?.trim() || null,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    currency: "usd",
    parameters: input.parameters,
    status: "draft",
    stripeCheckoutSessionId: null,
    createdByEmail: input.createdByEmail ?? null,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  store.offers = store.offers || [];
  store.offers.push(offer);
  store.updatedAt = now;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as Store;
    },
  });
  return offer;
}

export async function updateCustomTrainingOffer(
  id: string,
  patch: Partial<
    Pick<
      CustomTrainingOffer,
      | "status"
      | "stripeCheckoutSessionId"
      | "memberUserId"
      | "memberEmail"
      | "priceCents"
      | "parameters"
      | "notes"
    >
  >,
): Promise<CustomTrainingOffer> {
  const store = await getStore();
  const idx = store.offers?.findIndex((o) => o.id === id) ?? -1;
  if (idx < 0) throw new Error("Custom training offer not found.");
  const current = normalizeOffer(store.offers![idx])!;
  const next: CustomTrainingOffer = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.offers![idx] = next;
  store.updatedAt = next.updatedAt;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as Store;
    },
  });
  return next;
}