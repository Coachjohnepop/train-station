import "server-only";

import type { OAuthProvider } from "@/lib/oauth/types";
import type { StoredOAuthIdentity } from "@/lib/oauth-identity-types";
import { prisma } from "@/lib/prisma";

function rowToStoredIdentity(row: {
  provider: string;
  providerUserId: string;
  userId: string;
  email: string;
  linkedAt: Date;
}): StoredOAuthIdentity {
  return {
    provider: row.provider as OAuthProvider,
    providerUserId: row.providerUserId,
    userId: row.userId,
    email: row.email,
    linkedAt: row.linkedAt.toISOString(),
  };
}

export async function getOAuthIdentityFromDb(
  provider: OAuthProvider,
  providerUserId: string,
): Promise<StoredOAuthIdentity | null> {
  const row = await prisma.oAuthIdentity.findUnique({
    where: {
      provider_providerUserId: { provider, providerUserId },
    },
  });
  return row ? rowToStoredIdentity(row) : null;
}

export async function linkOAuthIdentityToDb(
  input: StoredOAuthIdentity,
): Promise<StoredOAuthIdentity> {
  const linkedAt = new Date(input.linkedAt);
  const row = await prisma.oAuthIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    },
    create: {
      provider: input.provider,
      providerUserId: input.providerUserId,
      userId: input.userId,
      email: input.email,
      linkedAt,
    },
    update: {
      userId: input.userId,
      email: input.email,
      linkedAt,
    },
  });

  return rowToStoredIdentity(row);
}

export async function probeOAuthIdentityDb(): Promise<{ ok: boolean; message: string | null }> {
  try {
    await prisma.oAuthIdentity.count();
    return { ok: true, message: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth identity DB probe failed";
    return { ok: false, message };
  }
}