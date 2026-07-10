import "server-only";

import { createHash, randomBytes } from "crypto";
import path from "path";
import {
  blobReadFallbackEnabled,
  readsFromDatabase,
  writesToBlob,
  writesToDatabase,
} from "@/lib/blob-migration-config";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  issuePasswordResetTokenToDb,
  lookupPasswordResetTokenFromDb,
  revokePasswordResetTokenFromDb,
} from "@/lib/password-reset-db";
import type { StoredResetToken } from "@/lib/password-reset-types";

export type { StoredResetToken };

type ResetStore = Record<string, StoredResetToken>;

const BLOB_PATH = "demo/password-reset-tokens.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "password-reset-tokens.dev.json");
const STORE_KEY = "password-reset-tokens" as const;
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
  if (!writesToBlob(STORE_KEY)) {
    memoryStore = store;
    return { blobSaved: true };
  }

  return persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });
}

async function upsertTokenForEmailInBlob(
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
    if (!blobSaved) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }

    // Instance memory is updated synchronously in saveStore — trust it before CDN catches up.
    if (memoryStore?.[key]?.email === email) return true;

    const verify = await getStore({ preferFresh: true });
    if (verify[key]?.email === email) return true;

    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  return false;
}

async function mirrorTokenToDb(
  email: string,
  key: string,
  entry: StoredResetToken,
): Promise<void> {
  if (!writesToDatabase(STORE_KEY) || isDemoMode()) return;
  await issuePasswordResetTokenToDb(email, key, entry);
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

  let persisted = true;

  if (writesToBlob(STORE_KEY)) {
    persisted = await upsertTokenForEmailInBlob(email, key, entry);
    if (!persisted) {
      console.error(
        "[password-reset] token store did not persist to blob — reset email suppressed",
      );
    }
  }

  if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
    try {
      await mirrorTokenToDb(email, key, entry);
      if (!writesToBlob(STORE_KEY)) {
        persisted = true;
      }
    } catch (error) {
      if (!writesToBlob(STORE_KEY)) {
        persisted = false;
        console.error("[password-reset] token store did not persist to DB", error);
      }
    }
  }

  return { token, persisted };
}

export async function lookupPasswordResetToken(
  token: string,
): Promise<StoredResetToken | null> {
  const key = hashToken(token);

  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const fromDb = await lookupPasswordResetTokenFromDb(key);
      if (fromDb) return fromDb;
      if (!blobReadFallbackEnabled(STORE_KEY)) return null;
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn(
        "[migration] password-reset-tokens DB read failed, falling back to blob",
        error,
      );
    }
  }

  const store = await getStore({ preferFresh: true });
  const entry = store[key];
  if (!entry) return null;
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    const next = { ...store };
    delete next[key];
    await saveStore(next);
    if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
      await revokePasswordResetTokenFromDb(key);
    }
    return null;
  }
  return entry;
}

export async function revokePasswordResetToken(token: string): Promise<void> {
  const key = hashToken(token);

  if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
    await revokePasswordResetTokenFromDb(key);
  }

  if (!writesToBlob(STORE_KEY)) return;

  const store = await getStore({ preferFresh: true });
  if (!store[key]) return;
  const next = { ...store };
  delete next[key];
  await saveStore(next);
}