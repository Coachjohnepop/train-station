import "server-only";

import path from "path";
import type { OAuthProvider } from "@/lib/oauth/types";
import {
  blobReadFallbackEnabled,
  readsFromDatabase,
  writesToBlob,
  writesToDatabase,
} from "@/lib/blob-migration-config";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  getOAuthIdentityFromDb,
  linkOAuthIdentityToDb,
} from "@/lib/oauth-identity-db";
import {
  oauthIdentityKey,
  type StoredOAuthIdentity,
} from "@/lib/oauth-identity-types";

export type { StoredOAuthIdentity };

type OAuthIdentityStore = Record<string, StoredOAuthIdentity>;

const BLOB_PATH = "demo/oauth-identities.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "oauth-identities.dev.json");
const STORE_KEY = "oauth-identities" as const;

let memoryStore: OAuthIdentityStore | null = null;

async function loadOAuthStoreFromBlob(
  opts?: { preferFresh?: boolean },
): Promise<OAuthIdentityStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as OAuthIdentityStore) || {};
    },
    fallback: () => ({}),
    preferFresh: opts?.preferFresh,
  });
  memoryStore = hydrated as OAuthIdentityStore;
  return memoryStore;
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<OAuthIdentityStore> {
  return loadOAuthStoreFromBlob(opts);
}

async function mirrorOAuthIdentityToDb(record: StoredOAuthIdentity): Promise<void> {
  if (!writesToDatabase(STORE_KEY) || isDemoMode()) return;
  await linkOAuthIdentityToDb(record);
}

export async function getOAuthIdentity(
  provider: OAuthProvider,
  providerUserId: string,
): Promise<StoredOAuthIdentity | null> {
  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const fromDb = await getOAuthIdentityFromDb(provider, providerUserId);
      if (fromDb) return fromDb;
      if (!blobReadFallbackEnabled(STORE_KEY)) return null;
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn("[migration] oauth-identities DB read failed, falling back to blob", error);
    }
  }

  const store = await getStore({ preferFresh: true });
  return store[oauthIdentityKey(provider, providerUserId)] || null;
}

export async function linkOAuthIdentity(input: {
  provider: OAuthProvider;
  providerUserId: string;
  userId: string;
  email: string;
}): Promise<StoredOAuthIdentity> {
  const record: StoredOAuthIdentity = {
    provider: input.provider,
    providerUserId: input.providerUserId,
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    linkedAt: new Date().toISOString(),
  };

  if (!writesToBlob(STORE_KEY) && writesToDatabase(STORE_KEY) && !isDemoMode()) {
    return linkOAuthIdentityToDb(record);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const store = await getStore({ preferFresh: attempt === 0 });
    store[oauthIdentityKey(input.provider, input.providerUserId)] = record;

    let blobSaved = true;
    if (writesToBlob(STORE_KEY)) {
      const result = await persistJsonStore({
        blobPath: BLOB_PATH,
        localPath: DEV_FILE,
        data: store,
        setMemory: (v) => {
          memoryStore = v as OAuthIdentityStore;
        },
      });
      blobSaved = result.blobSaved;
      if (!blobSaved && attempt < 3) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      requireBlobPersisted(blobSaved, "OAuth identity link");
    } else {
      memoryStore = store;
    }

    await mirrorOAuthIdentityToDb(record);
    return record;
  }

  throw new Error("Could not link social sign-in — please try again.");
}