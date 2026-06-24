import "server-only";

import path from "path";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";

type WebhookEventStore = Record<string, { processedAt: string; type: string }>;

const BLOB_PATH = "demo/stripe-webhook-events.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "stripe-webhook-events.dev.json");

let memoryStore: WebhookEventStore | null = null;

async function getStore(): Promise<WebhookEventStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v;
    },
    fallback: () => readLocalJson<WebhookEventStore>(DEV_FILE) || {},
  });
  memoryStore = hydrated;
  return hydrated;
}

/** Returns true if this is a new event; false if already processed (replay). */
export async function claimStripeWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const store = await getStore();
  if (store[eventId]) return false;

  store[eventId] = { processedAt: new Date().toISOString(), type: eventType };
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
  return true;
}