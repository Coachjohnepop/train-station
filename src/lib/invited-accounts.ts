import { normalizeAccountEmail } from "@/lib/account-email";
import { isDemoMode } from "@/lib/demo-enrollments";
import { canSignInWithEmail } from "@/lib/member-accounts-store";

/** Emails that can sign in (seed coaches/members + self-registered members + DB users). */
export async function isInvitedAccountEmail(email: string): Promise<boolean> {
  if (await canSignInWithEmail(email)) return true;

  if (isDemoMode()) return false;

  const normalized = normalizeAccountEmail(email);
  if (!normalized) return false;

  try {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    return Boolean(user && !user.hidden);
  } catch {
    return false;
  }
}