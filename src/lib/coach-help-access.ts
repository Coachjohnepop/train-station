import "server-only";

import { normalizeAccountEmail } from "@/lib/account-email";
import type { SessionUser } from "@/lib/auth-session";
import { canAccessCoachAdmin } from "@/lib/staff-access";
import { xaiApiKey } from "@/lib/xai-chat";

/** Emails that see the in-app Grok help panel (comma-separated env override). */
export function coachHelpAllowlist(): Set<string> {
  const raw =
    process.env.COACH_HELP_EMAILS?.trim() ||
    "jeremy@thetrainstation.co,john@thetrainstation.co";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((e) => normalizeAccountEmail(e))
      .filter(Boolean) as string[],
  );
}

export function canUseCoachHelpAssistant(session: SessionUser | null): boolean {
  if (!session?.email || !canAccessCoachAdmin(session.role)) return false;
  const email = normalizeAccountEmail(session.email);
  if (!email) return false;
  return coachHelpAllowlist().has(email);
}

/** John / platform admins can read coach suggestions inbox. */
export function canViewCoachHelpSuggestions(session: SessionUser | null): boolean {
  if (!session) return false;
  return session.role === "ADMIN" || session.role === "PLATFORM_ADMIN";
}

export function isCoachHelpConfigured(): boolean {
  const key = xaiApiKey();
  return Boolean(key && key.length > 20);
}