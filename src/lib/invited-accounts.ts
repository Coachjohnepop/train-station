import { canSignInWithEmail } from "@/lib/member-accounts-store";

/** Emails that can sign in (seed coaches/members + self-registered members). */
export async function isInvitedAccountEmail(email: string): Promise<boolean> {
  return canSignInWithEmail(email);
}