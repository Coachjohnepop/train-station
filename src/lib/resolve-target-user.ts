import { DEFAULT_DEMO_MEMBER_ID } from "@/lib/demo-coach";
import { resolveDemoUser, resolveDemoUserByEmail } from "@/lib/demo-user-directory";

/** Resolve forUser query param (email or demo user id) to a stable user id. */
export function resolveTargetUserId(
  forUser?: string | null,
  fallback: string = DEFAULT_DEMO_MEMBER_ID,
): string {
  if (!forUser?.trim()) return fallback;
  const raw = forUser.trim();
  const byEmail = resolveDemoUserByEmail(raw);
  if (byEmail) return byEmail.id;
  const byId = resolveDemoUser(raw);
  if (byId) return byId.id;
  return raw;
}