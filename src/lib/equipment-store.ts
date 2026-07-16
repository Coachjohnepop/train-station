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
import { extractAmazonAsin } from "@/lib/link-preview";

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

function normalizeOptionalUrl(
  value?: string | null,
  label = "link",
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`${label} must be http(s)`);
    }
    return u.toString();
  } catch (err) {
    if (err instanceof Error && err.message.includes("must be http")) throw err;
    throw new Error(`Enter a valid ${label} (https://…)`);
  }
}

/** Coach image override — any public http(s) image URL. */
function normalizeOptionalImageUrl(value?: string | null): string | null {
  return normalizeOptionalUrl(value, "image URL");
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

function isPrismaNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

/** Where the catalog is stored — UI can show "saved to database". */
export function equipmentCatalogStorage(): "postgres" | "demo" {
  return isDemoMode() ? "demo" : "postgres";
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

function amazonTileImage(productUrl: string | null): string | null {
  if (!productUrl) return null;
  const asin = extractAmazonAsin(productUrl);
  if (!asin) return null;
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
}

export async function createEquipmentItem(
  data: EquipmentWriteInput,
): Promise<EquipmentCatalogItem> {
  const name = data.name.trim();
  if (!name) throw new Error("Equipment name is required");
  const productUrl =
    data.productUrl === undefined
      ? null
      : normalizeOptionalUrl(data.productUrl, "product link");
  let imageUrl =
    data.imageUrl === undefined
      ? null
      : data.imageUrl?.trim()
        ? normalizeOptionalImageUrl(data.imageUrl)
        : null;
  // Prefer a resolvable product tile when coach only pasted a link
  if (!imageUrl && productUrl) {
    imageUrl = amazonTileImage(productUrl);
  }

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

  try {
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
  } catch (err) {
    if (isPrismaUniqueError(err)) {
      throw new Error("Equipment with that name already exists");
    }
    throw err;
  }
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

  if (data.name !== undefined) {
    const n = data.name.trim();
    if (!n) throw new Error("Equipment name is required");
    patch.name = n;
  }
  if (data.category !== undefined) patch.category = data.category?.trim() || null;
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.productUrl !== undefined) {
    patch.productUrl = normalizeOptionalUrl(data.productUrl, "product link");
  }
  if (data.imageUrl !== undefined) {
    patch.imageUrl = data.imageUrl?.trim()
      ? normalizeOptionalImageUrl(data.imageUrl)
      : null;
  }

  // If product link is set and image left empty on this save, seed Amazon tile
  // (coach can still override imageUrl explicitly on a later save).
  if (patch.imageUrl === null || patch.imageUrl === undefined) {
    const productForTile =
      patch.productUrl !== undefined
        ? patch.productUrl
        : data.productUrl === undefined
          ? undefined
          : normalizeOptionalUrl(data.productUrl, "product link");
    if (
      data.imageUrl !== undefined &&
      !patch.imageUrl &&
      productForTile
    ) {
      const tile = amazonTileImage(productForTile);
      if (tile) patch.imageUrl = tile;
    }
  }

  if (isDemoMode()) {
    const updated = await updateDemoEquipmentItem(id, patch);
    return mapCatalogRow(updated);
  }

  try {
    const updated = await prisma.equipment.update({
      where: { id },
      data: patch,
    });
    return mapCatalogRow(updated);
  } catch (err) {
    if (isPrismaNotFoundError(err)) throw new Error("Equipment not found");
    if (isPrismaUniqueError(err)) {
      throw new Error("Equipment with that name already exists");
    }
    throw err;
  }
}

export async function deleteEquipmentItem(id: string): Promise<void> {
  if (isDemoMode()) {
    await deleteDemoEquipmentItem(id);
    return;
  }

  try {
    await prisma.userEquipment.deleteMany({ where: { equipmentId: id } });
    await prisma.exerciseEquipment.deleteMany({ where: { equipmentId: id } });
    await prisma.equipment.delete({ where: { id } });
  } catch (err) {
    if (isPrismaNotFoundError(err)) throw new Error("Equipment not found");
    throw err;
  }
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
