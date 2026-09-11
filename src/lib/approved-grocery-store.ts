import "server-only";

import { isDatabaseConfigured } from "@/lib/database-config";
import { prisma } from "@/lib/prisma";
import { APPROVED_GROCERY_SEED } from "@/lib/approved-grocery-seed";

export type GroceryFoodRow = {
  id: string;
  name: string;
  aliases: string;
  category: string;
  whyGood: string;
  whyAvoid: string;
  sortOrder: number;
  archivedAt: string | null;
};

function requireDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("Grocery list needs Postgres. Set DATABASE_URL.");
  }
}

function mapFood(row: {
  id: string;
  name: string;
  aliases: string;
  category: string;
  whyGood: string;
  whyAvoid: string;
  sortOrder: number;
  archivedAt: Date | null;
}): GroceryFoodRow {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    category: row.category,
    whyGood: row.whyGood,
    whyAvoid: row.whyAvoid,
    sortOrder: row.sortOrder,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

export async function ensureApprovedGrocerySeed(): Promise<number> {
  requireDb();
  const count = await prisma.approvedGroceryFood.count();
  if (count > 0) return 0;
  await prisma.approvedGroceryFood.createMany({
    data: APPROVED_GROCERY_SEED.map((row) => ({
      name: row.name,
      aliases: row.aliases,
      category: row.category,
      whyGood: row.whyGood,
      whyAvoid: row.whyAvoid,
      sortOrder: row.sortOrder,
    })),
  });
  return APPROVED_GROCERY_SEED.length;
}

export async function listApprovedGroceryFoods(opts?: {
  archive?: "active" | "archived" | "all";
}): Promise<GroceryFoodRow[]> {
  requireDb();
  await ensureApprovedGrocerySeed();
  const archive = opts?.archive ?? "active";
  const rows = await prisma.approvedGroceryFood.findMany({
    where:
      archive === "all"
        ? {}
        : archive === "archived"
          ? { archivedAt: { not: null } }
          : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(mapFood);
}

export async function createApprovedGroceryFood(input: {
  name: string;
  aliases?: string;
  category?: string;
  whyGood?: string;
  whyAvoid?: string;
  sortOrder?: number;
}): Promise<GroceryFoodRow> {
  requireDb();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Name is required.");
  const row = await prisma.approvedGroceryFood.create({
    data: {
      name,
      aliases: (input.aliases ?? "").trim(),
      category: (input.category ?? "protein").trim() || "protein",
      whyGood: (input.whyGood ?? "").trim() || "On Jeremy’s cleanse list.",
      whyAvoid: (input.whyAvoid ?? "").trim() || "Leave off-list foods in the aisle.",
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 500,
    },
  });
  return mapFood(row);
}

export async function updateApprovedGroceryFood(
  id: string,
  patch: Partial<{
    name: string;
    aliases: string;
    category: string;
    whyGood: string;
    whyAvoid: string;
    sortOrder: number;
    action: "archive" | "restore";
  }>,
): Promise<GroceryFoodRow> {
  requireDb();
  const data: Record<string, unknown> = {};
  if (typeof patch.name === "string" && patch.name.trim()) data.name = patch.name.trim();
  if (typeof patch.aliases === "string") data.aliases = patch.aliases;
  if (typeof patch.category === "string" && patch.category.trim()) {
    data.category = patch.category.trim();
  }
  if (typeof patch.whyGood === "string") data.whyGood = patch.whyGood;
  if (typeof patch.whyAvoid === "string") data.whyAvoid = patch.whyAvoid;
  if (typeof patch.sortOrder === "number") data.sortOrder = patch.sortOrder;
  if (patch.action === "archive") data.archivedAt = new Date();
  if (patch.action === "restore") data.archivedAt = null;
  const row = await prisma.approvedGroceryFood.update({ where: { id }, data });
  return mapFood(row);
}

export type ShoppingItemRow = {
  id: string;
  label: string;
  originalLabel: string;
  checked: boolean;
  sortOrder: number;
  approvedFoodId: string | null;
  swapNote: string | null;
  trainstationized: boolean;
};

export async function getOrCreateMemberShoppingList(userId: string): Promise<{
  id: string;
  items: ShoppingItemRow[];
}> {
  requireDb();
  let list = await prisma.memberShoppingList.findUnique({
    where: { userId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!list) {
    list = await prisma.memberShoppingList.create({
      data: { userId },
      include: { items: true },
    });
  }
  return {
    id: list.id,
    items: list.items.map((item) => ({
      id: item.id,
      label: item.label,
      originalLabel: item.originalLabel,
      checked: item.checked,
      sortOrder: item.sortOrder,
      approvedFoodId: item.approvedFoodId,
      swapNote: item.swapNote,
      trainstationized: item.trainstationized,
    })),
  };
}

export async function addShoppingItems(
  userId: string,
  labels: string[],
): Promise<ShoppingItemRow[]> {
  requireDb();
  const list = await getOrCreateMemberShoppingList(userId);
  const start = list.items.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
  const created = await prisma.$transaction(
    labels.map((label, i) =>
      prisma.memberShoppingListItem.create({
        data: {
          listId: list.id,
          label,
          originalLabel: label,
          sortOrder: start + i,
        },
      }),
    ),
  );
  await prisma.memberShoppingList.update({
    where: { id: list.id },
    data: { updatedAt: new Date() },
  });
  return created.map((item) => ({
    id: item.id,
    label: item.label,
    originalLabel: item.originalLabel,
    checked: item.checked,
    sortOrder: item.sortOrder,
    approvedFoodId: item.approvedFoodId,
    swapNote: item.swapNote,
    trainstationized: item.trainstationized,
  }));
}

export async function patchShoppingItem(
  userId: string,
  itemId: string,
  patch: Partial<{ checked: boolean; label: string }>,
): Promise<ShoppingItemRow> {
  requireDb();
  const list = await prisma.memberShoppingList.findUnique({ where: { userId } });
  if (!list) throw new Error("No shopping list.");
  const existing = await prisma.memberShoppingListItem.findFirst({
    where: { id: itemId, listId: list.id },
  });
  if (!existing) throw new Error("Item not found.");
  const row = await prisma.memberShoppingListItem.update({
    where: { id: itemId },
    data: {
      ...(typeof patch.checked === "boolean" ? { checked: patch.checked } : {}),
      ...(typeof patch.label === "string" && patch.label.trim()
        ? { label: patch.label.trim() }
        : {}),
    },
  });
  return {
    id: row.id,
    label: row.label,
    originalLabel: row.originalLabel,
    checked: row.checked,
    sortOrder: row.sortOrder,
    approvedFoodId: row.approvedFoodId,
    swapNote: row.swapNote,
    trainstationized: row.trainstationized,
  };
}

export async function deleteShoppingItem(userId: string, itemId: string): Promise<void> {
  requireDb();
  const list = await prisma.memberShoppingList.findUnique({ where: { userId } });
  if (!list) throw new Error("No shopping list.");
  await prisma.memberShoppingListItem.deleteMany({ where: { id: itemId, listId: list.id } });
}

export async function clearCheckedShoppingItems(userId: string): Promise<void> {
  requireDb();
  const list = await prisma.memberShoppingList.findUnique({ where: { userId } });
  if (!list) return;
  await prisma.memberShoppingListItem.deleteMany({
    where: { listId: list.id, checked: true },
  });
}

export async function applyTrainstationizeResults(
  userId: string,
  updates: Array<{
    itemId: string;
    label: string;
    approvedFoodId: string | null;
    swapNote: string;
  }>,
): Promise<ShoppingItemRow[]> {
  requireDb();
  const list = await prisma.memberShoppingList.findUnique({ where: { userId } });
  if (!list) throw new Error("No shopping list.");
  const out: ShoppingItemRow[] = [];
  for (const u of updates) {
    const existing = await prisma.memberShoppingListItem.findFirst({
      where: { id: u.itemId, listId: list.id },
    });
    if (!existing) continue;
    const row = await prisma.memberShoppingListItem.update({
      where: { id: u.itemId },
      data: {
        label: u.label,
        approvedFoodId: u.approvedFoodId,
        swapNote: u.swapNote,
        trainstationized: true,
      },
    });
    out.push({
      id: row.id,
      label: row.label,
      originalLabel: row.originalLabel,
      checked: row.checked,
      sortOrder: row.sortOrder,
      approvedFoodId: row.approvedFoodId,
      swapNote: row.swapNote,
      trainstationized: row.trainstationized,
    });
  }
  return out;
}
