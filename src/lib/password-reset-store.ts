import "server-only";

import { createHash, randomBytes } from "crypto";
import path from "path";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";

export type StoredResetToken = {
  email: string;
  expiresAt: string;
  createdAt: string;
};

type ResetStore = Record<string, StoredResetToken>;

const BLOB_PATH = "demo/password-reset-tokens.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "password-reset-tokens.dev.json");
const TOKEN_TTL_MS = 60 * 60 * 1000;

let memoryStore: ResetStore | null = null;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<ResetStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = v;
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated;
  return hydrated;
}

async function saveStore(store: ResetStore): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

export async function issuePasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const key = hashToken(token);
  const now = Date.now();
  const store = await getStore({ preferFresh: true });

  for (const [existingKey, entry] of Object.entries(store)) {
    if (entry.email === email) {
      delete store[existingKey];
    }
  }

  store[key] = {
    email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
  };

  const { blobSaved } = await saveStore(store);
  if (!blobSaved) {
    console.error("[password-reset] token store did not persist to blob — reset links may fail across instances");
  }
  return token;
}

export async function lookupPasswordResetToken(
  token: string,
): Promise<StoredResetToken | null> {
  const store = await getStore({ preferFresh: true });
  const entry = store[hashToken(token)];
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    delete store[hashToken(token)];
    await saveStore(store);
    return null;
  }
  return entry;
}

export async function revokePasswordResetToken(token: string): Promise<void> {
  const store = await getStore({ preferFresh: true });
  delete store[hashToken(token)];
  await saveStore(store);
}