import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { isDemoMode } from "@/lib/demo-enrollments";
import {
  DEFAULT_ENTITY_CODE,
  DEFAULT_ENTITY_NAME,
  SYSTEM_CHART,
} from "@/lib/accounting-books/chart-of-accounts";

/**
 * Ensure default entity + system chart of accounts exist.
 * Safe to call on every post (idempotent).
 */
export async function ensureAccountingBooks(): Promise<{ entityId: string } | null> {
  if (!isDatabaseConfigured() || isDemoMode()) return null;

  const { prisma } = await import("@/lib/prisma");
  const now = new Date();

  let entity = await prisma.acctEntity.findUnique({
    where: { code: DEFAULT_ENTITY_CODE },
  });

  if (!entity) {
    entity = await prisma.acctEntity.create({
      data: {
        code: DEFAULT_ENTITY_CODE,
        name: DEFAULT_ENTITY_NAME,
        legalName: "The Train Station",
        currency: "usd",
        fiscalYearStartMonth: 1,
        updatedAt: now,
      },
    });
  }

  const existing = await prisma.acctAccount.findMany({
    where: { entityId: entity.id, isSystem: true },
    select: { code: true },
  });
  const have = new Set(existing.map((a) => a.code));

  for (const def of SYSTEM_CHART) {
    if (have.has(def.code)) continue;
    await prisma.acctAccount.create({
      data: {
        entityId: entity.id,
        code: def.code,
        name: def.name,
        type: def.type,
        subtype: def.subtype,
        normalBalance: def.normalBalance,
        description: def.description,
        isSystem: true,
        sortOrder: def.sortOrder,
        updatedAt: now,
      },
    });
  }

  return { entityId: entity.id };
}
