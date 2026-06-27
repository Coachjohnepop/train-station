import "server-only";

import { getAdminManagedUser } from "@/lib/admin-managed-users";
import { isDemoMode } from "@/lib/demo-enrollments";
import { resolveDemoUser } from "@/lib/demo-user-directory";
import { getAccountByUserId } from "@/lib/member-accounts-store";
import { prisma } from "@/lib/prisma";

export async function resolveUserEmailById(userId: string): Promise<string | null> {
  const directory = resolveDemoUser(userId);
  if (directory?.email) return directory.email;

  const managed = await getAdminManagedUser(userId);
  if (managed?.email) return managed.email;

  const account = await getAccountByUserId(userId);
  if (account?.email) return account.email;

  if (!isDemoMode()) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) return user.email;
    } catch {
      /* fall through */
    }
  }

  return null;
}