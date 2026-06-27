import "server-only";

import path from "path";
import { randomUUID } from "crypto";
import type { UserRole } from "@/lib/auth-session";
import { normalizeAccountEmail } from "@/lib/account-email";
import { hydrateJsonStore, persistJsonStore, readLocalJson } from "@/lib/demo-json-blob";
import { hashPassword } from "@/lib/password";

export type StoredMemberAccount = {
  userId: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  hidden?: boolean;
  createdAt: string;
};

type RegisteredAccountsStore = Record<string, StoredMemberAccount>;

const SEED_ACCOUNTS_FILE = path.join(process.cwd(), "prisma", "accounts.dev.json");
const BLOB_PATH = "demo/registered-accounts.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "registered-accounts.dev.json");

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

async function getRegisteredStore(opts?: { preferFresh?: boolean }): Promise<RegisteredAccountsStore> {
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
  const registered = await getRegisteredStore();
  const account = registered[normalized];
  if (account) return !account.hidden;

  const seed = loadSeedAccounts();
  return Boolean(seed[normalized]);
}

export async function getAccountByEmail(email: string): Promise<StoredMemberAccount | null> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;
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

export type RegisterMemberInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  plan: string;
  password?: string;
};

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

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });

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
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });

  return account;
}

export async function setSignInAccountHidden(email: string, hidden: boolean): Promise<boolean> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;
  const store = await getRegisteredStore();
  const account = store[normalized];
  if (!account) return false;
  store[normalized] = { ...account, hidden };
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

export async function getAccountByUserId(
  userId: string,
): Promise<{ email: string; account: StoredMemberAccount } | null> {
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
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });

  return { email: normalized, userId: account.userId };
}

export async function removeSignInAccount(email: string): Promise<boolean> {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;
  const store = await getRegisteredStore();
  if (!store[normalized]) return false;
  delete store[normalized];
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

export async function registerMember(input: RegisterMemberInput): Promise<StoredMemberAccount> {
  const normalized = normalizeAccountEmail(input.email);
  if (!normalized) throw new Error("Invalid email.");

  const accounts = await getAllSignInAccounts();
  if (accounts[normalized]) {
    throw new Error("An account with this email already exists. Sign in instead.");
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

  const store = await getRegisteredStore();
  store[normalized] = account;

  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v;
    },
  });

  return account;
}