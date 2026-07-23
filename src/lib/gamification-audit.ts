import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type GamificationAuditAction =
  | "config.patch"
  | "promo.offer"
  | "promo.claim"
  | "promo.revoke"
  | "promo.expire"
  | "season.recompute"
  | "points.award"
  | "prize.award";

export type AuditContext = {
  actorId: string;
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit row. Never throws to callers — logging must not break product paths.
 * Safe for M&A: no secrets, no raw payment tokens; detail is scrubbed JSON only.
 */
export async function writeGamificationAudit(input: {
  action: GamificationAuditAction | string;
  actor: AuditContext;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await prisma.gamificationAuditLog.create({
      data: {
        actorId: input.actor.actorId,
        actorRole: input.actor.actorRole ?? null,
        action: input.action,
        targetId: input.targetId ?? null,
        detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.actor.ip ?? null,
        userAgent: input.actor.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error("gamification audit write failed", e);
  }
}

export function auditContextFromRequest(
  request: Request,
  actorId: string,
  actorRole?: string | null,
): AuditContext {
  return {
    actorId,
    actorRole: actorRole ?? null,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  };
}

export async function listGamificationAudit(opts?: {
  limit?: number;
  action?: string;
  actorId?: string;
}): Promise<
  Array<{
    id: string;
    at: string;
    actorId: string;
    actorRole: string | null;
    action: string;
    targetId: string | null;
    detail: unknown;
    ip: string | null;
  }>
> {
  if (!isDatabaseConfigured()) return [];
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
  const rows = await prisma.gamificationAuditLog.findMany({
    where: {
      ...(opts?.action ? { action: opts.action } : {}),
      ...(opts?.actorId ? { actorId: opts.actorId } : {}),
    },
    orderBy: { at: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    actorId: r.actorId,
    actorRole: r.actorRole,
    action: r.action,
    targetId: r.targetId,
    detail: r.detail,
    ip: r.ip,
  }));
}
