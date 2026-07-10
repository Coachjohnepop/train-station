import "server-only";

import path from "path";
import { randomUUID } from "crypto";
import type { UserRole } from "@/lib/auth-session";
import { normalizeAccountEmail } from "@/lib/account-email";
import {
  blobReadFallbackEnabled,
  readMode,
  readsFromDatabase,
  writesToBlob,
  writesToDatabase,
} from "@/lib/blob-migration-config";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import {
  loadAccountByEmailFromDb,
  loadAccountByUserIdFromDb,
  loadRegisteredAccountsFromDb,
  removeAccountByEmailFromDb,
  setAccountHiddenInDb,
  upsertAccountToDb,
} from "@/lib/member-accounts-db";
import { hashPassword } from "@/lib/password";
import { isDemoMode } from "@/lib/demo-enrollments";
import type { RegisterMemberInput, StoredMemberAccount } from "@/lib/member-accounts-types";
import { normalizeSignupPlan } from "@/lib/signup-plans";

export type { RegisterMemberInput, StoredMemberAccount };

type RegisteredAccountsStore = Record<string, StoredMemberAccount>;

const SEED_ACCOUNTS_FILE = path.join(process.cwd(), "prisma", "accounts.dev.json");
const BLOB_PATH = "demo/registered-accounts.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "registered-accounts.dev.json");
const STORE_KEY = "registered-accounts" as const;

let memoryStore: RegisteredAccountsStore | null = null;

type SeedAccount = {
  userId: string;
  role: UserRole;
  passwordHash?: string;
  name?: string;
  phone?: string;
};

function loadSeedAccounts(): Record<string, SeedAccount> {
  const seed = readLocalJson<Record<string, SeedAccount>>(SEED_ACCOUNTS_FILE);
  return seed || {};
}

async function loadRegisteredStoreFromBlob(
  opts?: { preferFresh?: boolean },
): Promise<RegisteredAccountsStore> {
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

async function loadRegisteredStoreFromDb(): Promise<RegisteredAccountsStore> {
  const store = await loadRegisteredAccountsFromDb();
  memoryStore = store;
  return store;
}

async function getRegisteredStore(opts?: { preferFresh?: boolean }): Promise<RegisteredAccountsStore> {
  if (isDemoMode() || readMode(STORE_KEY) === "blob") {
    return loadRegisteredStoreFromBlob(opts);
  }

  try {
    return await loadRegisteredStoreFromDb();
  } catch (error) {
    if (blobReadFallbackEnabled(STORE_KEY)) {
      console.warn("[migration] registered-accounts DB read failed, falling back to blob", error);
      return loadRegisteredStoreFromBlob(opts);
    }
    throw error;
  }
}

async function persistRegisteredStore(store: RegisteredAccountsStore): Promise<{ blobSaved: boolean }> {
  let blobSaved = true;

  if (writesToBlob(STORE_KEY)) {
    const result = await persistJsonStore({
      blobPath: BLOB_PATH,
      localPath: DEV_FILE,
      data: store,
      setMemory: (v) => {
        memoryStore = v;
      },
    });
    blobSaved = result.blobSaved;
  } else {
    memoryStore = store;
  }

  return { blobSaved };
}

async function mirrorAccountToDb(
  email: string,
  account: StoredMemberAccount,
): Promise<void> {
  if (!writesToDatabase(STORE_KEY) || isDemoMode()) return;
  await upsertAccountToDb({
    email,
    userId: account.userId,
    role: account.role,
    name: account.name,
    phone: account.phone,
    passwordHash: account.passwordHash,
    hidden: account.hidden,
    createdAt: account.createdAt,
  });
}

export async function getAllSignInAccounts(opts?: { preferFresh?: boolean }): Promise<
  Record<string, { userId: string; role: UserRole; passwordHash?: string; name?: string; phone?: string }>
> {
  const seed = loadSeedAccounts();
  const registered = await getRegisteredStore(
    opts?.preferFresh ? { preferFresh: true } : undefined,
  );
  const merged: Record<
    string,
    { userId: string; role: UserRole; passwordHash?: string; name?: string; phone?: string }
  > = { ...seed };

  for (const [email, account] of Object.entries(registered)) {
    merged[email] = {
      userId: account.userId,
      role: account.role,
      passwordHash: account.passwordHash ?? undefined,
      name: account.name,
      phone: account.phone ?? undefined,
    };
  }

  return merged;
}

export async function canSignInWithEmail(email: string): Promise<boolean> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;
  const registered = await getRegisteredStore({ preferFresh: true });
  const account = registered[normalized];
  if (account) return !account.hidden;

  const seed = loadSeedAccounts();
  return Boolean(seed[normalized]);
}

export async function getAccountByEmail(email: string): Promise<StoredMemberAccount | null> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;

  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const fromDb = await loadAccountByEmailFromDb(normalized);
      if (fromDb) return fromDb;
      if (!blobReadFallbackEnabled(STORE_KEY)) return null;
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn("[migration] registered-accounts DB read failed, falling back to blob", error);
    }
  }

  const registered = await getRegisteredStore();
  return registered[normalized] || null;
}

/** Self-registered members (ticket signup), excluding seeded coach/demo accounts. */
export async function listSelfRegisteredAccounts(): Promise<
  Array<{ email: string; account: StoredMemberAccount }>
> {
  const seedEmails = new Set(
    Object.keys(loadSeedAccounts())
      .map((e) => normalizeAccountEmail(e))
      .filter(Boolean) as string[],
  );
  const registered = await getRegisteredStore();
  return Object.entries(registered)
    .map(([email, account]) => ({
      email: normalizeAccountEmail(email) || email,
      account,
    }))
    .filter(({ email }) => !seedEmails.has(email));
}

/** Remove all self-registered members (keeps seeded coach/demo accounts). */
export async function clearSelfRegisteredAccounts(): Promise<{
  removedEmails: string[];
  removedUserIds: string[];
}> {
  const seedEmails = new Set(
    Object.keys(loadSeedAccounts())
      .map((e) => normalizeAccountEmail(e))
      .filter(Boolean) as string[],
  );
  const store = await getRegisteredStore();
  const removedEmails: string[] = [];
  const removedUserIds: string[] = [];

  for (const [email, account] of Object.entries(store)) {
    const normalized = normalizeAccountEmail(email) || email;
    if (seedEmails.has(normalized)) continue;
    removedEmails.push(normalized);
    removedUserIds.push(account.userId);
    delete store[email];
  }

  await persistRegisteredStore(store);

  return { removedEmails, removedUserIds };
}

export async function upsertSignInAccount(input: {
  email: string;
  userId: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  createdAt?: string;
}): Promise<StoredMemberAccount> {
  const normalized = normalizeAccountEmail(input.email);
  if (!normalized) throw new Error("Invalid email.");

  const store = await getRegisteredStore({ preferFresh: true });
  const existing = store[normalized];
  const account: StoredMemberAccount = {
    userId: input.userId,
    role: input.role,
    name: input.name,
    phone: input.phone !== undefined ? (input.phone ?? null) : (existing?.phone ?? null),
    passwordHash:
      input.passwordHash !== undefined
        ? (input.passwordHash ?? null)
        : (existing?.passwordHash ?? null),
    hidden: existing?.hidden,
    createdAt: input.createdAt || existing?.createdAt || new Date().toISOString(),
  };

  store[normalized] = account;
  await persistRegisteredStore(store);
  await mirrorAccountToDb(normalized, account);

  return account;
}

export async function setSignInAccountHidden(email: string, hidden: boolean): Promise<boolean> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;
  const store = await getRegisteredStore();
  const account = store[normalized];
  if (!account) return false;
  const updated = { ...account, hidden };
  store[normalized] = updated;
  await persistRegisteredStore(store);
  if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
    await setAccountHiddenInDb(normalized, hidden);
  }
  return true;
}

export async function getAccountByUserId(
  userId: string,
): Promise<{ email: string; account: StoredMemberAccount } | null> {
  if (!isDemoMode() && readsFromDatabase(STORE_KEY)) {
    try {
      const fromDb = await loadAccountByUserIdFromDb(userId);
      if (fromDb) return fromDb;
      if (!blobReadFallbackEnabled(STORE_KEY)) return null;
    } catch (error) {
      if (!blobReadFallbackEnabled(STORE_KEY)) throw error;
      console.warn("[migration] registered-accounts DB read failed, falling back to blob", error);
    }
  }

  const store = await getRegisteredStore();
  for (const [email, account] of Object.entries(store)) {
    if (account.userId === userId) {
      return { email: normalizeAccountEmail(email) || email, account };
    }
  }
  return null;
}

/** Remove one self-registered member (never seeded coach/demo accounts). */
export async function removeSelfRegisteredMemberByEmail(
  email: string,
): Promise<{ email: string; userId: string } | null> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;

  const seedEmails = new Set(
    Object.keys(loadSeedAccounts())
      .map((e) => normalizeAccountEmail(e))
      .filter(Boolean) as string[],
  );
  if (seedEmails.has(normalized)) return null;

  const store = await getRegisteredStore();
  const account = store[normalized];
  if (!account) return null;

  delete store[normalized];
  await persistRegisteredStore(store);
  if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
    await removeAccountByEmailFromDb(normalized);
  }

  return { email: normalized, userId: account.userId };
}

export async function removeSignInAccount(email: string): Promise<boolean> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;
  const store = await getRegisteredStore();
  if (!store[normalized]) return false;
  delete store[normalized];
  await persistRegisteredStore(store);
  if (writesToDatabase(STORE_KEY) && !isDemoMode()) {
    await removeAccountByEmailFromDb(normalized);
  }
  return true;
}

export async function registerMember(input: RegisterMemberInput): Promise<StoredMemberAccount> {
  const normalized = normalizeAccountEmail(input.email);
  if (!normalized) throw new Error("Invalid email.");
  const signupPlan = normalizeSignupPlan(input.plan);

  const accounts = await getAllSignInAccounts();
  if (accounts[normalized]) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }

  if (!isDemoMode()) {
    const fromDb = await loadAccountByEmailFromDb(normalized);
    if (fromDb) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }
  }

  const name = [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(" ") || "Member";
  const account: StoredMemberAccount = {
    userId: `member-${randomUUID().slice(0, 12)}`,
    role: "MEMBER",
    name,
    phone: input.phone?.trim() || null,
    passwordHash: input.password ? hashPassword(input.password) : null,
    createdAt: new Date().toISOString(),
  };

  // New signups always land in Postgres when a real database is configured (PR-5).
  if (!isDemoMode()) {
    await upsertAccountToDb({
      email: normalized,
      userId: account.userId,
      role: account.role,
      name: account.name,
      phone: account.phone,
      passwordHash: account.passwordHash,
      createdAt: account.createdAt,
      signupPlan,
    });
  }

  if (isDemoMode() || writesToBlob(STORE_KEY)) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const store = await getRegisteredStore({ preferFresh: true });
      if (store[normalized]) {
        throw new Error("An account with this email already exists. Sign in instead.");
      }
      store[normalized] = account;
      const { blobSaved } = await persistRegisteredStore(store);
      if (!blobSaved && writesToBlob(STORE_KEY) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      const verify = await getRegisteredStore();
      if (verify[normalized]?.userId === account.userId) return account;
    }

    throw new Error("Could not save your account right now — please try again in a moment.");
  }

  memoryStore = { ...(memoryStore ?? {}), [normalized]: account };
  return account;
}