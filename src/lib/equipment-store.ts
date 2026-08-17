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
import { resolveWorkingEquipmentImage } from "@/lib/equipment-image";
import {
  ORIGINAL_HOME_EQUIPMENT,
  homeEquipmentFromCatalog,
  homeEquipmentNote,
} from "@/lib/home-equipment-defaults";

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

/**
 * Gear shop = product link + working photo only.
 * Home equipment checklist items (no product URL) can exist without an image.
 */
export async function listEquipmentShopItems(): Promise<EquipmentCatalogItem[]> {
  const all = await listEquipmentCatalog();
  return all.filter(
    (item) => Boolean(item.productUrl?.trim()) && Boolean(item.imageUrl?.trim()),
  );
}

function amazonTileImage(productUrl: string | null): string | null {
  if (!productUrl) return null;
  const asin = extractAmazonAsin(productUrl);
  if (!asin) return null;
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.MAIN._SCRMZZZZZZ_.jpg`;
}

const PUBLISH_IMAGE_ERROR =
  "Cannot publish to Gear without a working product photo. Paste a custom Image URL that loads in a browser, or fix the product link — then try again.";

/**
 * If this item has a shop product link, require a fetchable image and return
 * the working URL to store. Home-only items (no productUrl) skip the check.
 */
async function enforcePublishablePhoto(
  productUrl: string | null,
  imageUrl: string | null,
): Promise<string | null> {
  if (!productUrl?.trim()) {
    // Not on Gear shop — photo optional
    return imageUrl;
  }

  // Seed Amazon MAIN tile when coach only set product link
  let candidateImage = imageUrl;
  if (!candidateImage) {
    candidateImage = amazonTileImage(productUrl);
  }

  const resolved = await resolveWorkingEquipmentImage(candidateImage, productUrl);
  if (!resolved) {
    throw new Error(PUBLISH_IMAGE_ERROR);
  }
  return resolved.imageUrl;
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

  imageUrl = await enforcePublishablePhoto(productUrl, imageUrl);

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
  const existing = isDemoMode()
    ? (await listDemoEquipmentCatalog()).find((row) => row.id === id)
    : await prisma.equipment.findUnique({ where: { id } });

  if (!existing) throw new Error("Equipment not found");

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

  const nextProductUrl =
    patch.productUrl !== undefined ? patch.productUrl : existing.productUrl ?? null;
  const nextImageUrl =
    patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl ?? null;

  // Always re-verify when publishing to Gear (product link present)
  const verifiedImage = await enforcePublishablePhoto(nextProductUrl, nextImageUrl);
  patch.imageUrl = verifiedImage;
  if (patch.productUrl === undefined && nextProductUrl) {
    // ensure imageUrl is written even if only name changed on a shop item
    patch.imageUrl = verifiedImage;
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

async function ensureOriginalHomeEquipmentRows(): Promise<void> {
  if (isDemoMode()) return;
  const existing = await prisma.equipment.findMany({ select: { id: true } });
  const have = new Set(existing.map((row) => row.id));
  for (const seed of ORIGINAL_HOME_EQUIPMENT) {
    if (have.has(seed.id)) continue;
    try {
      await prisma.equipment.create({
        data: {
          id: seed.id,
          name: seed.name,
          category: seed.category,
          description: null,
          productUrl: null,
          imageUrl: null,
        },
      });
    } catch (err) {
      if (!isPrismaUniqueError(err)) throw err;
    }
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
      productUrl: null,
      imageUrl: item.imageUrl ?? null,
      hasAtHome: item.hasAtHome,
      quantity: item.quantity ?? 1,
      notes: item.notes ?? "",
    }));
  }

  await ensureOriginalHomeEquipmentRows();
  const [catalogRows, userItems] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    prisma.userEquipment.findMany({ where: { userId } }),
  ]);

  const catalog = homeEquipmentFromCatalog(catalogRows.map(mapCatalogRow));
  const userMap = new Map(userItems.map((row) => [row.equipmentId, row]));

  return catalog.map((eq) => {
    const userItem = userMap.get(eq.id);
    return {
      id: eq.id,
      name: eq.name,
      category: eq.category,
      description: eq.description,
      productUrl: null,
      imageUrl: eq.imageUrl,
      hasAtHome: userItem
        ? userItem.hasAtHome
        : eq.id === BODYWEIGHT_EQUIPMENT_ID,
      quantity: userItem?.quantity ?? 1,
      notes: homeEquipmentNote(userItem?.notes) || homeEquipmentNote(eq.description),
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

  await ensureOriginalHomeEquipmentRows();
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
