import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GAMIFICATION_LEVERS,
  normalizeGamificationLevers,
  type GamificationLevers,
} from "@/lib/gamification-levers";
import type { Prisma } from "@/generated/prisma/client";

const CONFIG_ID = "default";

let memoryLevers: GamificationLevers | null = null;

export async function getGamificationLevers(): Promise<GamificationLevers> {
  if (!isDatabaseConfigured()) {
    return memoryLevers ?? { ...DEFAULT_GAMIFICATION_LEVERS };
  }
  try {
    const row = await prisma.gamificationConfig.findUnique({ where: { id: CONFIG_ID } });
    if (!row) {
      const levers = { ...DEFAULT_GAMIFICATION_LEVERS };
      await prisma.gamificationConfig.create({
        data: {
          id: CONFIG_ID,
          levers: levers as unknown as Prisma.InputJsonValue,
        },
      });
      memoryLevers = levers;
      return levers;
    }
    const levers = normalizeGamificationLevers(row.levers);
    memoryLevers = levers;
    return levers;
  } catch {
    return memoryLevers ?? { ...DEFAULT_GAMIFICATION_LEVERS };
  }
}

export async function saveGamificationLevers(
  patch: Partial<GamificationLevers>,
  updatedBy?: string | null,
): Promise<GamificationLevers> {
  const current = await getGamificationLevers();
  const next = normalizeGamificationLevers({ ...current, ...patch });

  if (!isDatabaseConfigured()) {
    memoryLevers = next;
    return next;
  }

  await prisma.gamificationConfig.upsert({
    where: { id: CONFIG_ID },
    create: {
      id: CONFIG_ID,
      levers: next as unknown as Prisma.InputJsonValue,
      updatedBy: updatedBy ?? null,
    },
    update: {
      levers: next as unknown as Prisma.InputJsonValue,
      updatedBy: updatedBy ?? null,
    },
  });
  memoryLevers = next;
  return next;
}
