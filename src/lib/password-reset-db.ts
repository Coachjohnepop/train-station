import "server-only";

import type { StoredResetToken } from "@/lib/password-reset-types";
import { prisma } from "@/lib/prisma";

export async function findLivePasswordResetRawToken(email: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      expiresAt: { gt: new Date() },
      rawToken: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  return row?.rawToken ?? null;
}

export async function issuePasswordResetTokenToDb(
  email: string,
  tokenHash: string,
  entry: StoredResetToken,
  rawToken: string,
): Promise<void> {
  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      email,
      rawToken,
      expiresAt: new Date(entry.expiresAt),
      createdAt: new Date(entry.createdAt),
    },
  });
}

export async function lookupPasswordResetTokenFromDb(
  tokenHash: string,
): Promise<StoredResetToken | null> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { tokenHash } });
    return null;
  }

  return {
    email: row.email,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function revokePasswordResetTokenFromDb(tokenHash: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
}

export async function probePasswordResetDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.passwordResetToken.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Password reset DB probe failed";
    return { ok: false, message };
  }
}