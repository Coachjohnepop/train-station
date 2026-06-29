import "server-only";

import path from "path";
import type { OAuthProvider } from "@/lib/oauth/types";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import { requireBlobPersisted } from "@/lib/demo-persistence";

export type StoredOAuthIdentity = {
  provider: OAuthProvider;
  providerUserId: string;
  userId: string;
  email: string;
  linkedAt: string;
};

type OAuthIdentityStore = Record<string, StoredOAuthIdentity>;

const BLOB_PATH = "demo/oauth-identities.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "oauth-identities.dev.json");

let memoryStore: OAuthIdentityStore | null = null;

function identityKey(provider: OAuthProvider, providerUserId: string): string {
  return `${provider}:${providerUserId}`;
}

async function getStore(opts?: { preferFresh?: boolean }): Promise<OAuthIdentityStore> {
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

export async function getOAuthIdentity(
  provider: OAuthProvider,
  providerUserId: string,
): Promise<StoredOAuthIdentity | null> {
  const store = await getStore({ preferFresh: true });
  return store[identityKey(provider, providerUserId)] || null;
}

export async function linkOAuthIdentity(input: {
  provider: OAuthProvider;
  providerUserId: string;
  userId: string;
  email: string;
}): Promise<StoredOAuthIdentity> {
  const key = identityKey(input.provider, input.providerUserId);
  const record: StoredOAuthIdentity = {
    provider: input.provider,
    providerUserId: input.providerUserId,
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    linkedAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const store = await getStore({ preferFresh: attempt === 0 });
    store[key] = record;
    const { blobSaved } = await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v as OAuthIdentityStore;
      },
    });
    if (!blobSaved && attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      continue;
    }
    requireBlobPersisted(blobSaved, "OAuth identity link");
    return record;
  }

  throw new Error("Could not link social sign-in — please try again.");
}