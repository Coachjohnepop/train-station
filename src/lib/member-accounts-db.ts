import "server-only";

import type { Role } from "@/generated/prisma/client";
import type { UserRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import type { StoredMemberAccount } from "@/lib/member-accounts-types";

function toUserRole(role: Role): UserRole {
  return role as UserRole;
}

function toPrismaRole(role: UserRole): Role {
  return role as Role;
}

function rowToStoredAccount(row: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  passwordHash: string | null;
  hidden: boolean;
  registeredAt: Date | null;
  createdAt: Date;
}): StoredMemberAccount {
  return {
    userId: row.id,
    role: toUserRole(row.role),
    name: row.name || "Member",
    phone: row.phone,
    passwordHash: row.passwordHash,
    hidden: row.hidden,
    createdAt: (row.registeredAt ?? row.createdAt).toISOString(),
  };
}

export async function loadAccountByEmailFromDb(
  email: string,
): Promise<StoredMemberAccount | null> {
  const row = await prisma.user.findUnique({ where: { email } });
  if (!row || row.hidden) return null;
  return rowToStoredAccount(row);
}

export async function loadAccountByUserIdFromDb(
  userId: string,
): Promise<{ email: string; account: StoredMemberAccount } | null> {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) return null;
  return {
    email: row.email,
    account: rowToStoredAccount(row),
  };
}

export async function loadRegisteredAccountsFromDb(): Promise<
  Record<string, StoredMemberAccount>
> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const store: Record<string, StoredMemberAccount> = {};
  for (const row of rows) {
    store[row.email] = rowToStoredAccount(row);
  }
  return store;
}

export async function upsertAccountToDb(input: {
  email: string;
  userId: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  passwordHash?: string | null;
  hidden?: boolean;
  createdAt?: string;
  signupPlan?: string | null;
}): Promise<StoredMemberAccount> {
  const registeredAt = input.createdAt ? new Date(input.createdAt) : undefined;
  const row = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      id: input.userId,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      role: toPrismaRole(input.role),
      passwordHash: input.passwordHash ?? null,
      hidden: input.hidden ?? false,
      hiddenAt: input.hidden ? new Date() : null,
      registeredAt: registeredAt ?? new Date(),
      signupPlan: input.signupPlan ?? null,
    },
    update: {
      name: input.name,
      phone: input.phone !== undefined ? (input.phone ?? null) : undefined,
      role: toPrismaRole(input.role),
      passwordHash:
        input.passwordHash !== undefined ? (input.passwordHash ?? null) : undefined,
      hidden: input.hidden,
      hiddenAt: input.hidden ? new Date() : null,
      ...(registeredAt ? { registeredAt } : {}),
      ...(input.signupPlan !== undefined ? { signupPlan: input.signupPlan } : {}),
    },
  });

  return rowToStoredAccount(row);
}

export async function setAccountHiddenInDb(
  email: string,
  hidden: boolean,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { email },
    data: {
      hidden,
      hiddenAt: hidden ? new Date() : null,
    },
  });
  return result.count > 0;
}

export async function removeAccountByEmailFromDb(email: string): Promise<boolean> {
  const result = await prisma.user.deleteMany({ where: { email } });
  return result.count > 0;
}

export async function probeMemberAccountsDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.user.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Member accounts DB probe failed";
    return { ok: false, message };
  }
}