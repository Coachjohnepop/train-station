import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";

export type AuditOutcome = "success" | "failure" | "denied" | "info";

export type RecordAuditEventInput = {
  action: string;
  outcome?: AuditOutcome;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Append-only audit row. Never throws to callers — audit must not break product paths.
 * Requires Postgres; no-ops (with console warn) when DB is not configured.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<string | null> {
  if (!isDatabaseConfigured()) {
    console.info(
      `[audit:demo] ${input.action} outcome=${input.outcome ?? "info"} entity=${input.entityType ?? "-"}/${input.entityId ?? "-"}`,
    );
    return null;
  }

  try {
    const row = await prisma.auditEvent.create({
      data: {
        action: input.action,
        outcome: input.outcome ?? "info",
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
    return row.id;
  } catch (e) {
    console.error("[audit] failed to write AuditEvent", input.action, e);
    return null;
  }
}
