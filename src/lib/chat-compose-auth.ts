import "server-only";

import { getSessionUser, isStaffRole } from "@/lib/auth";

export async function requireCoachChatAccess() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) {
    return { ok: false as const, error: "Coach access required" };
  }
  return { ok: true as const, session };
}