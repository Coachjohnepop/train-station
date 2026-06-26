import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type MerchandiseSku = {
  id: string;
  name: string;
  description: string | null;
  priceLabel: string;
  priceCents: number;
  stripePriceId: string | null;
  enabled: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type Store = { skus: MerchandiseSku[]; updatedAt: string };

const BLOB_PATH = "demo/merchandise-skus.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "merchandise-skus.dev.json");

let memoryStore: Store | null = null;

function emptyStore(): Store {
  return { skus: [], updatedAt: new Date().toISOString() };
}

function normalizeSku(raw: unknown): MerchandiseSku | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MerchandiseSku>;
  if (!data.id || !data.name) return null;
  const cents = Math.round(Number(data.priceCents) || 0);
  return {
    id: data.id,
    name: data.name.trim(),
    description: typeof data.description === "string" ? data.description : null,
    priceLabel:
      data.priceLabel?.trim() ||
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100),
    priceCents: cents,
    stripePriceId: data.stripePriceId?.trim() || null,
    enabled: data.enabled !== false,
    imageUrl: data.imageUrl?.trim() || null,
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
  memoryStore = hydrated as Store;
  return memoryStore;
}

export async function listMerchandiseSkus(): Promise<MerchandiseSku[]> {
  const store = await getStore();
  return (store.skus || [])
    .map(normalizeSku)
    .filter((s): s is MerchandiseSku => Boolean(s))
    .filter((s) => s.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllMerchandiseSkus(): Promise<MerchandiseSku[]> {
  const store = await getStore();
  return (store.skus || [])
    .map(normalizeSku)
    .filter((s): s is MerchandiseSku => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMerchandiseSku(id: string): Promise<MerchandiseSku | null> {
  const store = await getStore();
  const found = store.skus?.find((s) => s.id === id);
  return found ? normalizeSku(found) : null;
}

export async function createMerchandiseSku(input: {
  name: string;
  description?: string | null;
  priceCents: number;
  stripePriceId?: string | null;
  imageUrl?: string | null;
}): Promise<MerchandiseSku> {
  const store = await getStore();
  const now = new Date().toISOString();
  const cents = Math.max(0, Math.round(input.priceCents));
  const sku: MerchandiseSku = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    priceCents: cents,
    priceLabel: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      cents / 100,
    ),
    stripePriceId: input.stripePriceId?.trim() || null,
    enabled: true,
    imageUrl: input.imageUrl?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  store.skus = store.skus || [];
  store.skus.push(sku);
  store.updatedAt = now;
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as Store;
    },
  });
  return sku;
}