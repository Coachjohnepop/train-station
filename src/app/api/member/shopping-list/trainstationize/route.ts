import { NextResponse } from "next/server";
import { requireMemberAccess } from "@/lib/api-auth";
import {
  applyTrainstationizeResults,
  getOrCreateMemberShoppingList,
  listApprovedGroceryFoods,
} from "@/lib/approved-grocery-store";
import { planTrainstationize } from "@/lib/trainstationize-grocery";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireMemberAccess();
  if (!auth.ok) return auth.response;
  try {
    const [list, foods] = await Promise.all([
      getOrCreateMemberShoppingList(auth.session.id),
      listApprovedGroceryFoods({ archive: "active" }),
    ]);
    const unchecked = list.items.filter((i) => !i.checked);
    const plans = await planTrainstationize(unchecked, foods);
    await applyTrainstationizeResults(
      auth.session.id,
      plans.map((p) => ({
        itemId: p.itemId,
        label: p.label,
        approvedFoodId: p.approvedFoodId,
        swapNote: p.swapNote,
      })),
    );
    const next = await getOrCreateMemberShoppingList(auth.session.id);
    return NextResponse.json({
      ok: true,
      list: next,
      swapped: plans.filter((p) => p.approvedFoodId).length,
      offList: plans.filter((p) => !p.approvedFoodId).length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Could not Trainstationize.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
