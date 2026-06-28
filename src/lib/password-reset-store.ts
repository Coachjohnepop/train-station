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

async function saveStore(store: ResetStore): Promise<{ blobSaved: boolean }> {
  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

async function upsertTokenForEmail(
  email: string,
  key: string,
  entry: StoredResetToken,
): Promise<boolean> {
  // Retry if a concurrent reset for another address overwrote blob between read and write.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const latest = await getStore({ preferFresh: true });
    const next: ResetStore = { ...latest };

    for (const [existingKey, existing] of Object.entries(next)) {
      if (existing.email === email) {
        delete next[existingKey];
      }
    }

    next[key] = entry;
    const { blobSaved } = await saveStore(next);
    if (!blobSaved) return false;

    const verify = await getStore({ preferFresh: true });
    if (verify[key]?.email === email) return true;
  }

  return false;
}

export async function issuePasswordResetToken(
  email: string,
): Promise<{ token: string; persisted: boolean }> {
  const token = randomBytes(32).toString("hex");
  const key = hashToken(token);
  const now = Date.now();
  const entry: StoredResetToken = {
    email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MS).toISOString(),
  };

  const persisted = await upsertTokenForEmail(email, key, entry);
  if (!persisted) {
    console.error(
      "[password-reset] token store did not persist to blob — reset email suppressed",
    );
  }
  return { token, persisted };
}

export async function lookupPasswordResetToken(
  token: string,
): Promise<StoredResetToken | null> {
  const store = await getStore({ preferFresh: true });
  const entry = store[hashToken(token)];
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    const key = hashToken(token);
    const next = { ...store };
    delete next[key];
    await saveStore(next);
    return null;
  }
  return entry;
}

export async function revokePasswordResetToken(token: string): Promise<void> {
  const key = hashToken(token);
  const store = await getStore({ preferFresh: true });
  if (!store[key]) return;
  const next = { ...store };
  delete next[key];
  await saveStore(next);
}