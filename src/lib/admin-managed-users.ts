import "server-only";

import { randomUUID } from "crypto";
import path from "path";
import type { UserRole } from "@/lib/auth-session";
import { normalizeAccountEmail } from "@/lib/account-email";
import { hydrateJsonStore, persistJsonStore } from "@/lib/demo-json-blob";
import {
  getAllSignInAccounts,
  removeSignInAccount,
  setSignInAccountHidden,
  upsertSignInAccount,
} from "@/lib/member-accounts-store";

export type AdminManagedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: string;
  notes: string | null;
  phone: string | null;
  dailyReminderTime: string | null;
  hidden: boolean;
  hiddenAt: string | null;
  createdAt: string;
};

type ManagedUsersStore = Record<string, AdminManagedUser>;

const BLOB_PATH = "demo/admin-managed-users.json";
const DEV_FILE = path.join(process.cwd(), "prisma", "admin-managed-users.dev.json");

let memoryStore: ManagedUsersStore | null = null;

async function getStore(): Promise<ManagedUsersStore> {
  const hydrated = await hydrateJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    memory: memoryStore,
    setMemory: (v) => {
      memoryStore = (v as ManagedUsersStore) || {};
    },
    fallback: () => ({}),
  });
  memoryStore = hydrated as ManagedUsersStore;
  return memoryStore;
}

async function persistStore(store: ManagedUsersStore): Promise<void> {
  await persistJsonStore({
    blobPath: BLOB_PATH,
    localPath: DEV_FILE,
    data: store,
    setMemory: (v) => {
      memoryStore = v as ManagedUsersStore;
    },
  });
}

export async function listAdminManagedUsers(options?: {
  includeHidden?: boolean;
}): Promise<AdminManagedUser[]> {
  const store = await getStore();
  return Object.values(store)
    .filter((u) => options?.includeHidden || !(u.hidden ?? false))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAdminManagedUser(id: string): Promise<AdminManagedUser | null> {
  const store = await getStore();
  return Object.values(store).find((u) => u.id === id) ?? null;
}

export async function createAdminManagedUser(input: {
  email: string;
  name?: string;
  role: UserRole;
  status?: string;
  notes?: string | null;
  phone?: string | null;
  dailyReminderTime?: string | null;
}): Promise<AdminManagedUser> {
  const normalized = normalizeAccountEmail(input.email);
  if (!normalized) throw new Error("Invalid email.");

  const accounts = await getAllSignInAccounts();
  if (accounts[normalized]) {
    throw new Error("Email already exists — find the account in Users and Edit it.");
  }

  const store = await getStore();
  const id = `admin-user-${randomUUID().slice(0, 12)}`;
  const createdAt = new Date().toISOString();
  const user: AdminManagedUser = {
    id,
    email: normalized,
    name: input.name?.trim() || normalized.split("@")[0],
    role: input.role,
    status: input.status || "active",
    notes: input.notes ?? null,
    phone: input.phone ?? null,
    dailyReminderTime: input.dailyReminderTime ?? null,
    hidden: false,
    hiddenAt: null,
    createdAt,
  };

  store[normalized] = user;
  await persistStore(store);

  await upsertSignInAccount({
    email: normalized,
    userId: id,
    role: input.role,
    name: user.name,
    phone: user.phone,
    createdAt,
  });

  return user;
}

export async function updateAdminManagedUser(
  id: string,
  patch: Partial<
    Pick<
      AdminManagedUser,
      "name" | "role" | "status" | "notes" | "phone" | "dailyReminderTime" | "email"
    >
  >,
): Promise<AdminManagedUser> {
  const store = await getStore();
  const current = Object.values(store).find((u) => u.id === id);
  if (!current) throw new Error("User not found");

  const oldEmail = current.email;
  let nextEmail = oldEmail;
  if (patch.email) {
    const normalized = normalizeAccountEmail(patch.email);
    if (!normalized) throw new Error("Invalid email.");
    if (normalized !== oldEmail && store[normalized]) {
      throw new Error("Email already exists");
    }
    nextEmail = normalized;
  }

  const updated: AdminManagedUser = {
    ...current,
    ...patch,
    email: nextEmail,
    name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    phone: patch.phone !== undefined ? patch.phone : current.phone,
    dailyReminderTime:
      patch.dailyReminderTime !== undefined
        ? patch.dailyReminderTime
        : current.dailyReminderTime,
  };

  if (nextEmail !== oldEmail) {
    delete store[oldEmail];
    await removeSignInAccount(oldEmail);
  } else {
    delete store[oldEmail];
  }
  store[nextEmail] = updated;
  await persistStore(store);

  await upsertSignInAccount({
    email: nextEmail,
    userId: updated.id,
    role: updated.role,
    name: updated.name,
    phone: updated.phone,
    createdAt: updated.createdAt,
  });

  return updated;
}

/** Soft-hide: keeps row + sign-in record for Stripe/enrollment refs; blocks login. */
export async function hideAdminManagedUser(id: string): Promise<boolean> {
  const store = await getStore();
  const entry = Object.entries(store).find(([, u]) => u.id === id);
  if (!entry) return false;
  const [email, user] = entry;
  if (user.hidden) return true;

  const hiddenAt = new Date().toISOString();
  store[email] = { ...user, hidden: true, hiddenAt };
  await persistStore(store);
  await setSignInAccountHidden(email, true);
  return true;
}

export async function unhideAdminManagedUser(id: string): Promise<boolean> {
  const store = await getStore();
  const entry = Object.entries(store).find(([, u]) => u.id === id);
  if (!entry) return false;
  const [email, user] = entry;

  store[email] = { ...user, hidden: false, hiddenAt: null };
  await persistStore(store);
  await setSignInAccountHidden(email, false);
  return true;
}

/** @deprecated Prefer hideAdminManagedUser — hard delete breaks payment/enrollment refs. */
export async function deleteAdminManagedUser(id: string): Promise<boolean> {
  return hideAdminManagedUser(id);
}

export function adminManagedUserToRow(user: AdminManagedUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    notes: user.notes,
    phone: user.phone,
    dailyReminderTime: user.dailyReminderTime,
    hidden: user.hidden ?? false,
    hiddenAt: user.hiddenAt ?? null,
    createdAt: user.createdAt,
    subscription: null,
    counts: { enrollments: 0, performances: 0, workoutLogs: 0 },
    strengthScore: 0,
  };
}