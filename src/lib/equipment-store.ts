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
  productUrl: string | null;
  imageUrl: string | null;
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

export type EquipmentWriteInput = {
  name: string;
  category?: string | null;
  description?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
};

const BODYWEIGHT_EQUIPMENT_ID = "eq-bodyweightonly";

function normalizeOptionalUrl(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Product link must be http(s)");
    }
    return u.toString();
  } catch {
    throw new Error("Enter a valid product link (https://…)");
  }
}

function mapCatalogRow(row: {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
}): EquipmentCatalogItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    productUrl: row.productUrl ?? null,
    imageUrl: row.imageUrl ?? null,
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

/** Items with a buy link — member gear shop. */
export async function listEquipmentShopItems(): Promise<EquipmentCatalogItem[]> {
  const all = await listEquipmentCatalog();
  return all.filter((item) => Boolean(item.productUrl?.trim()));
}

export async function createEquipmentItem(
  data: EquipmentWriteInput,
): Promise<EquipmentCatalogItem> {
  const name = data.name.trim();
  if (!name) throw new Error("Equipment name is required");
  const productUrl =
    data.productUrl === undefined ? null : normalizeOptionalUrl(data.productUrl);
  const imageUrl =
    data.imageUrl === undefined
      ? null
      : data.imageUrl?.trim()
        ? normalizeOptionalUrl(data.imageUrl)
        : null;

  if (isDemoMode()) {
    const created = await createDemoEquipmentItem({
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
      productUrl,
      imageUrl,
    });
    return mapCatalogRow(created);
  }

  const created = await prisma.equipment.create({
    data: {
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
      productUrl,
      imageUrl,
    },
  });
  return mapCatalogRow(created);
}

export async function updateEquipmentItem(
  id: string,
  data: Partial<EquipmentWriteInput>,
): Promise<EquipmentCatalogItem> {
  const patch: {
    name?: string;
    category?: string | null;
    description?: string | null;
    productUrl?: string | null;
    imageUrl?: string | null;
  } = {};

  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.category !== undefined) patch.category = data.category?.trim() || null;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.productUrl !== undefined) patch.productUrl = normalizeOptionalUrl(data.productUrl);
  if (data.imageUrl !== undefined) {
    patch.imageUrl = data.imageUrl?.trim() ? normalizeOptionalUrl(data.imageUrl) : null;
  }

  if (isDemoMode()) {
    const updated = await updateDemoEquipmentItem(id, patch);
    return mapCatalogRow(updated);
  }

  const updated = await prisma.equipment.update({
    where: { id },
    data: patch,
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
      productUrl: item.productUrl ?? null,
      imageUrl: item.imageUrl ?? null,
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
      productUrl: eq.productUrl,
      imageUrl: eq.imageUrl,
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
