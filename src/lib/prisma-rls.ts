import "server-only";

import type { SessionUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo-enrollments";

/** Set Postgres session variables so RLS policies apply (requires non-superuser DB role). */
export async function withRlsContext<T>(
  session: SessionUser | null,
  fn: () => Promise<T>,
): Promise<T> {
  if (isDemoMode() || !session) {
    return fn();
  }

  const userId = session.id.replace(/'/g, "''");
  const role = session.role.replace(/'/g, "''");

  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.user_id', '${userId}', true), set_config('app.user_role', '${role}', true)`,
  );

  try {
    return await fn();
  } finally {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.user_id', '', true), set_config('app.user_role', '', true)`,
    );
  }
}