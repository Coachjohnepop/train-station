import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import { parseGroceryPaste } from "@/lib/approved-grocery-match";
import { GROCERY_CLEANSE_NOTE } from "@/lib/approved-grocery-seed";
import {
  addShoppingItems,
  clearCheckedShoppingItems,
  deleteShoppingItem,
  getOrCreateMemberShoppingList,
  patchShoppingItem,
} from "@/lib/approved-grocery-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  try {
    const list = await getOrCreateMemberShoppingList(auth.session.id);
    return NextResponse.json({ ok: true, list, note: GROCERY_CLEANSE_NOTE });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not load list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { text?: string; label?: string };
    const labels = parseGroceryPaste(String(body.text || body.label || ""));
    if (labels.length === 0) {
      return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
    }
    const items = await addShoppingItems(auth.session.id, labels);
    const list = await getOrCreateMemberShoppingList(auth.session.id);
    return NextResponse.json({ ok: true, added: items.length, list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not add items.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      itemId?: string;
      checked?: boolean;
      label?: string;
      clearChecked?: boolean;
    };
    if (body.clearChecked) {
      await clearCheckedShoppingItems(auth.session.id);
      const list = await getOrCreateMemberShoppingList(auth.session.id);
      return NextResponse.json({ ok: true, list });
    }
    if (!body.itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    await patchShoppingItem(auth.session.id, body.itemId, {
      checked: body.checked,
      label: body.label,
    });
    const list = await getOrCreateMemberShoppingList(auth.session.id);
    return NextResponse.json({ ok: true, list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not update item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  try {
    const itemId = new URL(request.url).searchParams.get("itemId") || "";
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    await deleteShoppingItem(auth.session.id, itemId);
    const list = await getOrCreateMemberShoppingList(auth.session.id);
    return NextResponse.json({ ok: true, list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not delete item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
