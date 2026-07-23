import "server-only";

import type { SessionUser } from "@/lib/auth-session";
import { recordAuditEvent, type RecordAuditEventInput } from "@/lib/audit-event";

/** Best-effort client IP (Vercel / proxies). */
export function clientIpFromRequest(request: Request | null | undefined): string | null {
  if (!request) return null;
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 80) : null;
}

export function userAgentFromRequest(request: Request | null | undefined): string | null {
  if (!request) return null;
  const ua = request.headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, 500) : null;
}

export type AuditActor = {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
};

export function actorFromSession(session: SessionUser | null | undefined): AuditActor {
  if (!session) return {};
  return {
    userId: session.id,
    email: session.email,
    role: session.role,
  };
}

/** Record audit with optional Request for IP / UA. Never throws. */
export async function auditFromRequest(
  request: Request | null | undefined,
  input: Omit<RecordAuditEventInput, "ip" | "userAgent"> & {
    actor?: AuditActor;
  },
): Promise<string | null> {
  const actor = input.actor ?? {};
  return recordAuditEvent({
    action: input.action,
    outcome: input.outcome,
    actorUserId: input.actorUserId ?? actor.userId,
    actorEmail: input.actorEmail ?? actor.email,
    actorRole: input.actorRole ?? actor.role,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    ip: clientIpFromRequest(request),
    userAgent: userAgentFromRequest(request),
  });
}
