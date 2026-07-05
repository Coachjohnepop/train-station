import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isDemoMode,
  getAllEquipmentWithUserStatus,
  setDemoUserEquipment,
  normalizeEquipmentUpdates,
  listDemoEquipmentCatalog,
  createDemoEquipmentItem,
  updateDemoEquipmentItem,
  deleteDemoEquipmentItem,
  type DemoEquipmentCatalogItem,
} from "@/lib/demo-equipment";

export type EquipmentCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

export type EquipmentWithUserStatus = EquipmentCatalogItem & {
  hasAtHome: boolean;
  quantity: number;
  notes: string;
};

export type EquipmentUpdateInput = {
  id?: string;
  equipmentId?: string;
  hasAtHome?: boolean;
  quantity?: number;
  notes?: string;
};

const BODYWEIGHT_EQUIPMENT_ID = "eq-bodyweightonly";

function mapCatalogRow(row: {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
}): EquipmentCatalogItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
  };
}

export async function listEquipmentCatalog(): Promise<EquipmentCatalogItem[]> {
  if (isDemoMode()) {
    const items = await listDemoEquipmentCatalog();
    return items.map(mapCatalogRow);
  }

  const rows = await prisma.equipment.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapCatalogRow);
}

export async function createEquipmentItem(data: {
  name: string;
  category?: string | null;
  description?: string | null;
}): Promise<EquipmentCatalogItem> {
  const name = data.name.trim();
  if (!name) throw new Error("Equipment name is required");

  if (isDemoMode()) {
    const created = await createDemoEquipmentItem({
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
    });
    return mapCatalogRow(created);
  }

  const created = await prisma.equipment.create({
    data: {
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
    },
  });
  return mapCatalogRow(created);
}

export async function updateEquipmentItem(
  id: string,
  data: { name?: string; category?: string | null; description?: string | null },
): Promise<EquipmentCatalogItem> {
  if (isDemoMode()) {
    const updated = await updateDemoEquipmentItem(id, {
      name: data.name?.trim(),
      category: data.category === undefined ? undefined : data.category?.trim() || null,
      description: data.description === undefined ? undefined : data.description?.trim() || null,
    });
    return mapCatalogRow(updated);
  }

  const updated = await prisma.equipment.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(data.description !== undefined
        ? { description: data.description?.trim() || null }
        : {}),
    },
  });
  return mapCatalogRow(updated);
}

export async function deleteEquipmentItem(id: string): Promise<void> {
  if (isDemoMode()) {
    await deleteDemoEquipmentItem(id);
    return;
  }

  await prisma.userEquipment.deleteMany({ where: { equipmentId: id } });
  await prisma.exerciseEquipment.deleteMany({ where: { equipmentId: id } });
  await prisma.equipment.delete({ where: { id } });
}

export async function getMemberEquipmentWithStatus(
  userId: string,
): Promise<EquipmentWithUserStatus[]> {
  if (isDemoMode()) {
    const items = await getAllEquipmentWithUserStatus(userId);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category ?? null,
      description: item.description ?? null,
      hasAtHome: item.hasAtHome,
      quantity: item.quantity ?? 1,
      notes: item.notes ?? "",
    }));
  }

  const [catalog, userItems] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    prisma.userEquipment.findMany({ where: { userId } }),
  ]);

  const userMap = new Map(userItems.map((row) => [row.equipmentId, row]));

  return catalog.map((eq) => {
    const userItem = userMap.get(eq.id);
    return {
      id: eq.id,
      name: eq.name,
      category: eq.category,
      description: eq.description,
      hasAtHome: userItem
        ? userItem.hasAtHome
        : eq.id === BODYWEIGHT_EQUIPMENT_ID,
      quantity: userItem?.quantity ?? 1,
      notes: userItem?.notes ?? eq.description ?? "",
    };
  });
}

export async function setMemberEquipment(
  userId: string,
  updates: EquipmentUpdateInput[],
): Promise<EquipmentWithUserStatus[]> {
  const normalized = normalizeEquipmentUpdates(updates);

  if (isDemoMode()) {
    await setDemoUserEquipment(normalized, userId);
    return getMemberEquipmentWithStatus(userId);
  }

  const catalogIds = new Set(
    (await prisma.equipment.findMany({ select: { id: true } })).map((row) => row.id),
  );

  for (const item of normalized) {
    if (!catalogIds.has(item.equipmentId)) continue;

    if (item.hasAtHome) {
      await prisma.userEquipment.upsert({
        where: {
          userId_equipmentId: { userId, equipmentId: item.equipmentId },
        },
        update: {
          hasAtHome: true,
          quantity: item.quantity ?? 1,
          notes: item.notes ?? null,
        },
        create: {
          userId,
          equipmentId: item.equipmentId,
          hasAtHome: true,
          quantity: item.quantity ?? 1,
          notes: item.notes ?? null,
        },
      });
    } else {
      await prisma.userEquipment.deleteMany({
        where: { userId, equipmentId: item.equipmentId },
      });
    }
  }

  return getMemberEquipmentWithStatus(userId);
}

export type { DemoEquipmentCatalogItem };